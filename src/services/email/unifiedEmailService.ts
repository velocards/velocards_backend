import {
  EmailProvider,
  EmailOptions,
  EmailResult,
  EmailServiceConfig,
  EmailProviderType,
  EmailMetrics,
  EmailDeliveryStatus
} from './types';
import { ResendProvider } from './providers/resendProvider';
import { SendGridProvider } from './providers/sendgridProvider';
import { ConsoleProvider } from './providers/consoleProvider';
import { CircuitBreaker, CircuitBreakerConfig } from './circuitBreaker';
import { EmailQueue } from './emailQueue';
import { supabase } from '../../config/database';
import logger from '../../utils/logger';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';

/**
 * Unified Email Service
 * Manages email providers with automatic fallback and monitoring
 */
export class UnifiedEmailService {
  private providers: Map<string, EmailProvider> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private queue: EmailQueue;
  private metrics: Map<string, EmailMetrics> = new Map();
  private config: EmailServiceConfig;

  constructor() {
    this.config = this.loadConfiguration();
    this.initializeProviders();
    this.queue = new EmailQueue();
    this.setupQueueProcessor();
    
    logger.info('Unified Email Service initialized', {
      providers: Array.from(this.providers.keys()),
      fallbackEnabled: this.config.fallbackEnabled
    });
  }

  /**
   * Load service configuration
   */
  private loadConfiguration(): EmailServiceConfig {
    return {
      providers: new Map([
        [EmailProviderType.RESEND, { priority: 1, enabled: true, maxRetries: 3, timeout: 30000 }],
        [EmailProviderType.SENDGRID, { priority: 2, enabled: true, maxRetries: 2, timeout: 30000 }],
        [EmailProviderType.CONSOLE, { priority: 99, enabled: env.NODE_ENV === 'development' }]
      ]),
      fallbackEnabled: true,
      retryDelayMs: 2000,
      maxRetries: 3,
      circuitBreakerThreshold: 3,
      circuitBreakerResetMs: 60000
    };
  }

  /**
   * Initialize email providers and circuit breakers
   */
  private initializeProviders(): void {
    const providerConfigs = [
      { type: EmailProviderType.RESEND, provider: new ResendProvider() },
      { type: EmailProviderType.SENDGRID, provider: new SendGridProvider() },
      { type: EmailProviderType.CONSOLE, provider: new ConsoleProvider() }
    ];

    for (const { type, provider } of providerConfigs) {
      const config = this.config.providers.get(type);
      
      if (config?.enabled && provider.isConfigured()) {
        this.providers.set(type, provider);
        
        // Initialize circuit breaker for this provider
        const cbConfig: CircuitBreakerConfig = {
          failureThreshold: this.config.circuitBreakerThreshold,
          resetTimeout: this.config.circuitBreakerResetMs,
          halfOpenMaxAttempts: 2
        };
        
        this.circuitBreakers.set(type, new CircuitBreaker(provider.name, cbConfig));
        
        // Initialize metrics
        this.metrics.set(type, {
          provider: provider.name,
          sent: 0,
          failed: 0
        });

        logger.info(`Email provider registered: ${provider.name}`);
      }
    }

    if (this.providers.size === 0) {
      logger.error('No email providers configured!');
      // In development, always add console provider
      if (env.NODE_ENV === 'development') {
        const consoleProvider = new ConsoleProvider();
        this.providers.set(EmailProviderType.CONSOLE, consoleProvider);
        logger.info('Using console provider for development');
      }
    }
  }

  /**
   * Setup queue processor
   */
  private setupQueueProcessor(): void {
    this.queue.process(async (item) => {
      await this.sendEmailInternal(item.options);
    });
  }

  /**
   * Get primary provider based on priority and health
   */
  private async getPrimaryProvider(): Promise<{ type: string; provider: EmailProvider } | null> {
    const sortedProviders = Array.from(this.providers.entries())
      .map(([type, provider]) => ({
        type,
        provider,
        config: this.config.providers.get(type as EmailProviderType)!
      }))
      .filter(p => p.config.enabled)
      .sort((a, b) => a.config.priority - b.config.priority);

    for (const { type, provider } of sortedProviders) {
      const circuitBreaker = this.circuitBreakers.get(type);
      
      if (circuitBreaker?.canAttempt() && await provider.isHealthy()) {
        return { type, provider };
      }
    }

    return null;
  }

  /**
   * Get fallback providers
   */
  private async getFallbackProviders(): Promise<Array<{ type: string; provider: EmailProvider }>> {
    if (!this.config.fallbackEnabled) {
      return [];
    }

    const primary = await this.getPrimaryProvider();
    const fallbacks: Array<{ type: string; provider: EmailProvider }> = [];

    for (const [type, provider] of this.providers.entries()) {
      if (type !== primary?.type) {
        const circuitBreaker = this.circuitBreakers.get(type);
        
        if (circuitBreaker?.canAttempt() && await provider.isHealthy()) {
          fallbacks.push({ type, provider });
        }
      }
    }

    return fallbacks.sort((a, b) => {
      const aConfig = this.config.providers.get(a.type as EmailProviderType)!;
      const bConfig = this.config.providers.get(b.type as EmailProviderType)!;
      return aConfig.priority - bConfig.priority;
    });
  }

  /**
   * Send email with automatic fallback
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    // Validate required fields
    if (!options.to || !options.subject || (!options.text && !options.html)) {
      throw new AppError('INVALID_EMAIL_OPTIONS', 'Missing required email fields', 400);
    }

    // Set default from address if not provided
    if (!options.from) {
      options.from = {
        email: env.FROM_EMAIL || 'noreply@velocards.com',
        name: env.FROM_NAME || 'VeloCards'
      };
    }

    try {
      return await this.sendEmailInternal(options);
    } catch (error: any) {
      logger.error('Failed to send email after all attempts', {
        to: options.to,
        subject: options.subject,
        error: error.message
      });

      // Queue for retry if all providers failed
      if (this.config.maxRetries > 0) {
        const queueId = await this.queue.enqueue(options, {
          delay: this.config.retryDelayMs,
          maxRetries: this.config.maxRetries
        });

        logger.info('Email queued for retry', {
          queueId,
          to: options.to,
          subject: options.subject
        });

        return {
          id: queueId,
          provider: 'queue',
          timestamp: new Date(),
          success: false,
          error: 'Email queued for retry'
        };
      }

      throw error;
    }
  }

  /**
   * Internal method to send email with fallback logic
   */
  private async sendEmailInternal(options: EmailOptions): Promise<EmailResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Try primary provider
    const primary = await this.getPrimaryProvider();
    
    if (primary) {
      try {
        const result = await this.attemptSend(primary.type, primary.provider, options);
        
        if (result.success) {
          await this.recordDeliveryStatus({
            emailId: result.id || '',
            provider: result.provider,
            status: 'sent',
            timestamp: new Date()
          });

          return result;
        }
        
        lastError = new Error(result.error || 'Unknown error');
      } catch (error: any) {
        lastError = error;
        logger.warn(`Primary provider ${primary.provider.name} failed`, {
          error: error.message,
          to: options.to
        });
      }
    }

    // Try fallback providers
    if (this.config.fallbackEnabled) {
      const fallbacks = await this.getFallbackProviders();
      
      for (const { type, provider } of fallbacks) {
        try {
          logger.info(`Attempting fallback provider: ${provider.name}`);
          
          const result = await this.attemptSend(type, provider, options);
          
          if (result.success) {
            await this.recordDeliveryStatus({
              emailId: result.id || '',
              provider: result.provider,
              status: 'sent',
              timestamp: new Date(),
              metadata: { fallback: true }
            });

            return result;
          }
          
          lastError = new Error(result.error || 'Unknown error');
        } catch (error: any) {
          lastError = error;
          logger.warn(`Fallback provider ${provider.name} failed`, {
            error: error.message,
            to: options.to
          });
        }
      }
    }

    // All providers failed
    const totalTime = Date.now() - startTime;
    
    await this.recordDeliveryStatus({
      emailId: '',
      provider: 'all',
      status: 'failed',
      timestamp: new Date(),
      error: lastError?.message || 'All email providers failed',
      metadata: { totalTime }
    });

    throw new AppError(
      'EMAIL_SEND_FAILED',
      lastError?.message || 'All email providers failed',
      500
    );
  }

  /**
   * Attempt to send email via specific provider
   */
  private async attemptSend(
    type: string,
    provider: EmailProvider,
    options: EmailOptions
  ): Promise<EmailResult> {
    const circuitBreaker = this.circuitBreakers.get(type);
    const metrics = this.metrics.get(type);

    try {
      const result = await provider.send(options);

      if (result.success) {
        circuitBreaker?.recordSuccess();
        
        if (metrics) {
          metrics.sent++;
          metrics.lastSuccess = new Date();
        }
      } else {
        circuitBreaker?.recordFailure();
        
        if (metrics) {
          metrics.failed++;
          metrics.lastFailure = new Date();
        }
      }

      return result;
    } catch (error) {
      circuitBreaker?.recordFailure();
      
      if (metrics) {
        metrics.failed++;
        metrics.lastFailure = new Date();
      }

      throw error;
    }
  }

  /**
   * Record email delivery status for monitoring
   */
  private async recordDeliveryStatus(status: EmailDeliveryStatus): Promise<void> {
    try {
      await supabase
        .from('email_delivery_logs')
        .insert({
          email_id: status.emailId,
          provider: status.provider,
          status: status.status,
          timestamp: status.timestamp,
          error: status.error,
          metadata: status.metadata
        });
    } catch (error) {
      // Log but don't throw - delivery logging is non-critical
      logger.warn('Failed to record email delivery status', { error });
    }
  }

  /**
   * Queue an email for delayed sending
   */
  async queueEmail(
    options: EmailOptions,
    delay?: number
  ): Promise<string> {
    return await this.queue.enqueue(options, delay ? { delay } : {});
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    const providers = [];
    
    for (const [type, provider] of this.providers.entries()) {
      const circuitBreaker = this.circuitBreakers.get(type);
      const metrics = this.metrics.get(type);
      
      providers.push({
        type,
        name: provider.name,
        configured: provider.isConfigured(),
        healthy: await provider.isHealthy(),
        circuitState: circuitBreaker?.getState(),
        metrics
      });
    }

    const queueStats = await this.queue.getStats();

    return {
      providers,
      queue: queueStats,
      fallbackEnabled: this.config.fallbackEnabled
    };
  }

  /**
   * Get service metrics
   */
  getMetrics(): Map<string, EmailMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset circuit breakers (for recovery)
   */
  resetCircuitBreakers(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
    
    logger.info('All circuit breakers reset');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.queue.shutdown();
    logger.info('Unified Email Service shut down');
  }
}