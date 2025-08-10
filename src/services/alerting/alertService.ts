import { emailProvider } from '../emailProvider';
import { LoggerService } from '../logging/loggerService';
import { supabase } from '../../config/database';
import { captureSecurityEvent } from '../../config/sentry';
import axios from 'axios';
import { env } from '../../config/env';
import redis from '../../config/redis';

const logger = new LoggerService();

export interface Alert {
  id?: string;
  type: 'security' | 'rate_limit' | 'anomaly' | 'system';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  details?: any;
  userId?: string;
  ipAddress?: string;
  endpoint?: string;
  createdAt?: Date;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'sentry';
  enabled: boolean;
  config?: any;
}

// Circuit breaker state for external services
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: Date;
  state: 'closed' | 'open' | 'half-open';
}

export class AlertService {
  // Circuit breaker configuration
  private static circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private static readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private static readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  private static alertChannels: AlertChannel[] = [
    {
      type: 'email',
      enabled: true,
      config: {
        recipients: ['security@velocards.com']
      }
    },
    {
      type: 'slack',
      enabled: false,
      config: {
        webhookUrl: ''
      }
    },
    {
      type: 'sentry',
      enabled: !!env.SENTRY_DSN,
      config: {}
    }
  ];

  // Alert throttling configuration
  private static throttleConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAlerts: 1 // Max 1 alert per type per window
  };

  // Alert throttle cache key prefix for Redis
  private static readonly THROTTLE_KEY_PREFIX = 'alert_throttle:';

  /**
   * Send alert through configured channels
   */
  static async sendAlert(alert: Alert): Promise<void> {
    try {
      // Check throttling
      if (await this.isThrottled(alert)) {
        logger.debug('Alert throttled', { type: alert.type, title: alert.title });
        return;
      }

      // Store alert in database
      await this.storeAlert(alert);

      // Send through each enabled channel
      const promises = [];

      for (const channel of this.alertChannels) {
        if (channel.enabled) {
          switch (channel.type) {
            case 'email':
              promises.push(this.sendEmailAlert(alert, channel.config));
              break;
            case 'slack':
              promises.push(this.sendSlackAlert(alert, channel.config));
              break;
            case 'sentry':
              promises.push(this.sendSentryAlert(alert));
              break;
          }
        }
      }

      await Promise.allSettled(promises);

      // Update throttle
      await this.updateThrottle(alert);

      logger.info('Alert sent successfully', {
        type: alert.type,
        severity: alert.severity,
        title: alert.title
      });
    } catch (error) {
      logger.error('Failed to send alert', error, { alert });
    }
  }

  /**
   * Check if circuit breaker allows request
   */
  private static isCircuitOpen(service: string): boolean {
    const state = this.circuitBreaker.get(service);
    if (!state) return false;

    const now = new Date();
    const timeSinceLastFailure = now.getTime() - state.lastFailureTime.getTime();

    if (state.state === 'open') {
      if (timeSinceLastFailure > this.CIRCUIT_BREAKER_TIMEOUT) {
        // Try half-open state
        state.state = 'half-open';
        state.failures = 0;
        return false;
      }
      return true; // Circuit is open, block request
    }

    return false;
  }

  /**
   * Record circuit breaker success
   */
  private static recordCircuitSuccess(service: string): void {
    const state = this.circuitBreaker.get(service);
    if (state && state.state === 'half-open') {
      // Reset circuit breaker on success in half-open state
      this.circuitBreaker.delete(service);
    }
  }

  /**
   * Record circuit breaker failure
   */
  private static recordCircuitFailure(service: string): void {
    let state = this.circuitBreaker.get(service);
    
    if (!state) {
      state = {
        failures: 0,
        lastFailureTime: new Date(),
        state: 'closed'
      };
      this.circuitBreaker.set(service, state);
    }

    state.failures++;
    state.lastFailureTime = new Date();

    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.state = 'open';
      logger.error(`Circuit breaker opened for ${service} after ${state.failures} failures`);
    }
  }

  /**
   * Send email alert with error boundary
   */
  private static async sendEmailAlert(alert: Alert, config: any): Promise<void> {
    // Check circuit breaker
    if (this.isCircuitOpen('email')) {
      logger.warn('Email circuit breaker is open, skipping alert');
      return;
    }
    try {
      const recipients = config.recipients || ['security@velocards.com'];
      const severityColors = {
        LOW: '#28a745',
        MEDIUM: '#ffc107',
        HIGH: '#fd7e14',
        CRITICAL: '#dc3545'
      };

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .alert-container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .alert-header { 
              background-color: ${severityColors[alert.severity]}; 
              color: white; 
              padding: 15px; 
              border-radius: 5px 5px 0 0;
            }
            .alert-body { 
              background-color: #f8f9fa; 
              padding: 20px; 
              border: 1px solid #dee2e6;
              border-radius: 0 0 5px 5px;
            }
            .details { 
              background-color: white; 
              padding: 10px; 
              margin-top: 15px;
              border-radius: 3px;
              border: 1px solid #dee2e6;
            }
            .footer { margin-top: 20px; font-size: 12px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="alert-container">
            <div class="alert-header">
              <h2>🚨 ${alert.severity} Security Alert</h2>
              <h3>${alert.title}</h3>
            </div>
            <div class="alert-body">
              <p><strong>Type:</strong> ${alert.type}</p>
              <p><strong>Time:</strong> ${new Date().toISOString()}</p>
              <p><strong>Message:</strong></p>
              <p>${alert.message}</p>
              
              ${alert.details ? `
                <div class="details">
                  <strong>Details:</strong>
                  <pre>${JSON.stringify(alert.details, null, 2)}</pre>
                </div>
              ` : ''}
              
              ${alert.userId ? `<p><strong>User ID:</strong> ${alert.userId}</p>` : ''}
              ${alert.ipAddress ? `<p><strong>IP Address:</strong> ${alert.ipAddress}</p>` : ''}
              ${alert.endpoint ? `<p><strong>Endpoint:</strong> ${alert.endpoint}</p>` : ''}
              
              <div class="footer">
                <p>This is an automated security alert from Velocards Security Monitoring System.</p>
                <p>Please investigate immediately if this is a HIGH or CRITICAL severity alert.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      for (const recipient of recipients) {
        await emailProvider.send({
          to: recipient,
          from: {
            email: 'security@velocards.com',
            name: 'Velocards Security'
          },
          subject: `[${alert.severity}] Security Alert: ${alert.title}`,
          text: `${alert.severity} Alert: ${alert.title}\n\n${alert.message}\n\nDetails: ${JSON.stringify(alert.details, null, 2)}`,
          html
        });
      }

      logger.debug('Email alert sent', { recipients });
      this.recordCircuitSuccess('email');
    } catch (error) {
      logger.error('Failed to send email alert', error);
      this.recordCircuitFailure('email');
      // Don't throw - fail silently to prevent cascading failures
    }
  }

  /**
   * Send Slack alert with error boundary
   */
  private static async sendSlackAlert(alert: Alert, config: any): Promise<void> {
    // Check circuit breaker
    if (this.isCircuitOpen('slack')) {
      logger.warn('Slack circuit breaker is open, skipping alert');
      return;
    }
    try {
      if (!config.webhookUrl) {
        logger.warn('Slack webhook URL not configured');
        return;
      }

      const severityEmojis: Record<string, string> = {
        LOW: '🟢',
        MEDIUM: '🟡',
        HIGH: '🟠',
        CRITICAL: '🔴'
      };

      const payload = {
        text: `${severityEmojis[alert.severity]} *${alert.severity} Security Alert*`,
        attachments: [
          {
            color: alert.severity === 'CRITICAL' ? 'danger' : 
                   alert.severity === 'HIGH' ? 'warning' : 
                   alert.severity === 'MEDIUM' ? '#ffc107' : 'good',
            title: alert.title,
            text: alert.message,
            fields: [
              {
                title: 'Type',
                value: alert.type,
                short: true
              },
              {
                title: 'Severity',
                value: alert.severity,
                short: true
              },
              ...(alert.userId ? [{
                title: 'User ID',
                value: alert.userId,
                short: true
              }] : []),
              ...(alert.ipAddress ? [{
                title: 'IP Address',
                value: alert.ipAddress,
                short: true
              }] : []),
              ...(alert.endpoint ? [{
                title: 'Endpoint',
                value: alert.endpoint,
                short: false
              }] : [])
            ],
            footer: 'Velocards Security',
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      if (alert.details && payload.attachments && payload.attachments[0] && payload.attachments[0].fields) {
        payload.attachments[0].fields.push({
          title: 'Details',
          value: `\`\`\`${JSON.stringify(alert.details, null, 2)}\`\`\``,
          short: false
        });
      }

      await axios.post(config.webhookUrl, payload, {
        timeout: 5000 // 5 second timeout
      });

      logger.debug('Slack alert sent');
      this.recordCircuitSuccess('slack');
    } catch (error) {
      logger.error('Failed to send Slack alert', error);
      this.recordCircuitFailure('slack');
      // Don't throw - fail silently to prevent cascading failures
    }
  }

  /**
   * Send Sentry alert
   */
  private static async sendSentryAlert(alert: Alert): Promise<void> {
    try {
      captureSecurityEvent(
        alert.type,
        alert.severity.toLowerCase() as any,
        {
          title: alert.title,
          message: alert.message,
          ...alert.details
        }
      );

      logger.debug('Sentry alert sent');
    } catch (error) {
      logger.error('Failed to send Sentry alert', error);
      throw error;
    }
  }

  /**
   * Store alert in database
   */
  private static async storeAlert(alert: Alert): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .insert({
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          details: alert.details || {},
          user_id: alert.userId,
          ip_address: alert.ipAddress,
          endpoint: alert.endpoint,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to store alert', error);
      }
    } catch (error) {
      logger.error('Failed to store alert in database', error);
    }
  }

  /**
   * Check if alert is throttled (using Redis)
   */
  private static async isThrottled(alert: Alert): Promise<boolean> {
    try {
      const key = `${this.THROTTLE_KEY_PREFIX}${alert.type}:${alert.title}`;
      const throttleData = await redis.get(key);
      
      if (!throttleData) {
        return false;
      }

      const throttleEntry = JSON.parse(throttleData);
      const now = new Date();
      const resetTime = new Date(throttleEntry.resetTime);

      if (now > resetTime) {
        await redis.del(key);
        return false;
      }

      return throttleEntry.count >= this.throttleConfig.maxAlerts;
    } catch (error) {
      logger.error('Failed to check throttle status', error);
      // On Redis error, allow alert to proceed
      return false;
    }
  }

  /**
   * Update throttle tracking (using Redis)
   */
  private static async updateThrottle(alert: Alert): Promise<void> {
    try {
      const key = `${this.THROTTLE_KEY_PREFIX}${alert.type}:${alert.title}`;
      const now = new Date();
      const throttleData = await redis.get(key);
      
      let throttleEntry;
      if (!throttleData) {
        throttleEntry = {
          count: 1,
          resetTime: new Date(now.getTime() + this.throttleConfig.windowMs).toISOString()
        };
      } else {
        throttleEntry = JSON.parse(throttleData);
        const resetTime = new Date(throttleEntry.resetTime);
        
        if (now > resetTime) {
          throttleEntry = {
            count: 1,
            resetTime: new Date(now.getTime() + this.throttleConfig.windowMs).toISOString()
          };
        } else {
          throttleEntry.count++;
        }
      }

      // Set with TTL matching the window
      const ttl = Math.ceil(this.throttleConfig.windowMs / 1000);
      await redis.setex(key, ttl, JSON.stringify(throttleEntry));
    } catch (error) {
      logger.error('Failed to update throttle', error);
      // Continue even if throttle update fails
    }
  }

  /**
   * Send CRITICAL security alert
   */
  static async sendCriticalAlert(
    title: string,
    message: string,
    details?: any
  ): Promise<void> {
    await this.sendAlert({
      type: 'security',
      severity: 'CRITICAL',
      title,
      message,
      details
    });
  }

  /**
   * Send rate limit alert
   */
  static async sendRateLimitAlert(
    identifier: string,
    endpoint: string,
    requestCount: number,
    maxRequests: number
  ): Promise<void> {
    await this.sendAlert({
      type: 'rate_limit',
      severity: 'MEDIUM',
      title: 'Rate Limit Exceeded',
      message: `Rate limit exceeded for ${identifier} on endpoint ${endpoint}`,
      details: {
        identifier,
        endpoint,
        requestCount,
        maxRequests,
        exceededBy: requestCount - maxRequests
      },
      endpoint
    });
  }

  /**
   * Send anomaly alert
   */
  static async sendAnomalyAlert(
    anomalyType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    userId?: string,
    details?: any
  ): Promise<void> {
    await this.sendAlert({
      type: 'anomaly',
      severity,
      title: `Anomaly Detected: ${anomalyType}`,
      message: `An anomaly of type ${anomalyType} has been detected`,
      ...(userId && { userId }),
      details
    });
  }

  /**
   * Acknowledge alert
   */
  static async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: acknowledgedBy,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) {
        logger.error('Failed to acknowledge alert', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error acknowledging alert', error);
      return { success: false, error: 'Failed to acknowledge alert' };
    }
  }

  /**
   * Get unacknowledged alerts
   */
  static async getUnacknowledgedAlerts(): Promise<Alert[]> {
    try {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get unacknowledged alerts', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting unacknowledged alerts', error);
      return [];
    }
  }
}