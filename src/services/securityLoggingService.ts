import { Request } from 'express';
import logger from '../utils/logger';
import { UserRepository } from '../repositories/userRepository';

export interface SecurityEvent {
  userId?: string;
  email?: string;
  eventType: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class SecurityLoggingService {
  /**
   * Extract client IP address from request
   */
  static getClientIp(req: Request): string {
    // Check for forwarded IPs (common in production behind proxies/load balancers)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0]?.trim() || 'unknown';
      } else if (Array.isArray(forwarded) && forwarded.length > 0 && forwarded[0]) {
        return String(forwarded[0]).split(',')[0]?.trim() || 'unknown';
      }
    }
    
    // Fallback to direct connection IP
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Extract user agent from request
   */
  static getUserAgent(req: Request): string {
    return req.headers['user-agent'] || 'unknown';
  }

  /**
   * Log failed login attempt
   */
  static async logFailedLogin(email: string, req: Request, reason?: string): Promise<void> {
    const event: SecurityEvent = {
      email,
      eventType: 'failed_login',
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      metadata: { reason },
      timestamp: new Date()
    };

    logger.warn('Failed login attempt', event);
    
    // Try to find user and record in database
    try {
      const user = await UserRepository.findByEmail(email);
      if (user) {
        await UserRepository.recordAuthEvent(
          user.id,
          'login_failed',
          event.ipAddress,
          event.userAgent
        );
      }
    } catch (error) {
      // Don't throw, just log
      logger.error('Failed to record auth event:', error);
    }
  }

  /**
   * Log successful login
   */
  static async logSuccessfulLogin(userId: string, email: string, req: Request): Promise<void> {
    const event: SecurityEvent = {
      userId,
      email,
      eventType: 'successful_login',
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      timestamp: new Date()
    };

    logger.info('Successful login', event);
    
    try {
      await UserRepository.recordAuthEvent(
        userId,
        'login_success',
        event.ipAddress,
        event.userAgent
      );
    } catch (error) {
      logger.error('Failed to record auth event:', error);
    }
  }

  /**
   * Log rate limit violation
   */
  static logRateLimitViolation(req: Request, endpoint?: string): void {
    const event = {
      eventType: 'rate_limit_violation',
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      endpoint: endpoint || req.path,
      method: req.method,
      timestamp: new Date()
    };

    logger.warn('Rate limit violation', event);
  }

  /**
   * Log suspicious activity
   */
  static logSuspiciousActivity(
    req: Request, 
    activityType: string, 
    details?: Record<string, any>
  ): void {
    const event = {
      eventType: 'suspicious_activity',
      activityType,
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      details,
      timestamp: new Date()
    };

    logger.warn('Suspicious activity detected', event);
  }

  /**
   * Log API key usage
   */
  static logApiKeyUsage(
    req: Request,
    apiKeyId: string,
    success: boolean,
    reason?: string
  ): void {
    const event = {
      eventType: 'api_key_usage',
      apiKeyId,
      success,
      reason,
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      path: req.path,
      method: req.method,
      timestamp: new Date()
    };

    if (success) {
      logger.info('API key used successfully', event);
    } else {
      logger.warn('API key usage failed', event);
    }
  }

  /**
   * Log KYC verification attempt
   */
  static logKycAttempt(
    userId: string,
    req: Request,
    status: 'started' | 'completed' | 'failed',
    provider?: string,
    reason?: string
  ): void {
    const event = {
      eventType: 'kyc_verification',
      userId,
      status,
      provider,
      reason,
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      timestamp: new Date()
    };

    logger.info('KYC verification attempt', event);
  }

  /**
   * Log admin action
   */
  static logAdminAction(
    req: Request,
    action: string,
    targetResource?: string,
    details?: Record<string, any>
  ): void {
    const event = {
      eventType: 'admin_action',
      userId: (req as any).user?.id,
      action,
      targetResource,
      details,
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      path: req.path,
      method: req.method,
      timestamp: new Date()
    };

    logger.info('Admin action performed', event);
  }

  /**
   * Log password reset attempt
   */
  static logPasswordResetAttempt(
    email: string,
    req: Request,
    success: boolean,
    reason?: string
  ): void {
    const event = {
      eventType: 'password_reset_attempt',
      email,
      success,
      reason,
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      timestamp: new Date()
    };

    logger.info('Password reset attempt', event);
  }

  /**
   * Log card operation
   */
  static logCardOperation(
    userId: string,
    req: Request,
    operation: 'created' | 'activated' | 'frozen' | 'terminated' | 'viewed',
    cardId?: string,
    success: boolean = true
  ): void {
    const event = {
      eventType: 'card_operation',
      userId,
      operation,
      cardId,
      success,
      ipAddress: this.getClientIp(req),
      userAgent: this.getUserAgent(req),
      timestamp: new Date()
    };

    logger.info('Card operation', event);
  }

  /**
   * Log transaction anomaly
   */
  static logTransactionAnomaly(
    userId: string,
    anomalyType: string,
    details: Record<string, any>
  ): void {
    const event = {
      eventType: 'transaction_anomaly',
      userId,
      anomalyType,
      details,
      timestamp: new Date()
    };

    logger.warn('Transaction anomaly detected', event);
  }
}