import { supabase } from '../../config/database';
import { LoggerService } from '../logging/loggerService';
import { Request } from 'express';
import { SecurityLoggingService } from '../securityLoggingService';

const logger = new LoggerService();

export interface AnomalyDetectionConfig {
  failedLoginThreshold: number;
  failedLoginWindow: number; // in minutes
  bruteForceThreshold: number;
  bruteForceWindow: number; // in minutes
  ipAnomalyThreshold: number;
  unusualAccessThreshold: number;
}

export class AnomalyDetectionService {
  private static config: AnomalyDetectionConfig = {
    failedLoginThreshold: 5,
    failedLoginWindow: 15,
    bruteForceThreshold: 10,
    bruteForceWindow: 5,
    ipAnomalyThreshold: 3,
    unusualAccessThreshold: 100
  };

  /**
   * Check for failed login attempts anomaly
   */
  static async checkFailedLoginAttempts(
    userId: string | undefined,
    ipAddress: string
  ): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - this.config.failedLoginWindow * 60 * 1000);
      
      // Query failed login attempts
      let query = supabase
        .from('security_audit_logs')
        .select('count')
        .eq('action', 'auth.login')
        .eq('result', 'failure')
        .gte('timestamp', windowStart.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.eq('ip_address', ipAddress);
      }

      const { count, error } = await query;

      if (error) {
        logger.error('Failed to check login attempts', error);
        return false;
      }

      if ((count || 0) >= this.config.failedLoginThreshold) {
        logger.security(
          'FAILED_LOGIN_THRESHOLD_EXCEEDED',
          'HIGH',
          {
            userId,
            ipAddress,
            attempts: count,
            threshold: this.config.failedLoginThreshold,
            window: `${this.config.failedLoginWindow} minutes`
          }
        );

        // Log to security events
        await this.logSecurityEvent(
          'failed_login',
          'high',
          userId,
          ipAddress,
          {
            attempts: count,
            threshold: this.config.failedLoginThreshold
          }
        );

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in checkFailedLoginAttempts', error);
      return false;
    }
  }

  /**
   * Detect brute force attack patterns
   */
  static async detectBruteForce(ipAddress: string): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - this.config.bruteForceWindow * 60 * 1000);
      
      // Check rapid-fire requests from same IP
      const { count, error } = await supabase
        .from('security_audit_logs')
        .select('count')
        .eq('ip_address', ipAddress)
        .eq('action', 'auth.login')
        .gte('timestamp', windowStart.toISOString());

      if (error) {
        logger.error('Failed to check brute force', error);
        return false;
      }

      if ((count || 0) >= this.config.bruteForceThreshold) {
        logger.security(
          'BRUTE_FORCE_DETECTED',
          'CRITICAL',
          {
            ipAddress,
            attempts: count,
            threshold: this.config.bruteForceThreshold,
            window: `${this.config.bruteForceWindow} minutes`
          }
        );

        // Log to security events
        await this.logSecurityEvent(
          'suspicious_activity',
          'critical',
          undefined,
          ipAddress,
          {
            type: 'brute_force',
            attempts: count,
            threshold: this.config.bruteForceThreshold
          }
        );

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in detectBruteForce', error);
      return false;
    }
  }

  /**
   * Detect IP-based anomalies
   */
  static async detectIPAnomaly(userId: string, newIpAddress: string): Promise<boolean> {
    try {
      // Get user's recent IP addresses
      const { data: recentLogs, error } = await supabase
        .from('security_audit_logs')
        .select('ip_address')
        .eq('user_id', userId)
        .eq('result', 'success')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Failed to check IP history', error);
        return false;
      }

      if (!recentLogs || recentLogs.length === 0) {
        return false; // First login, no anomaly
      }

      // Check if this is a new IP
      const uniqueIPs = new Set(recentLogs.map(log => log.ip_address));
      
      if (!uniqueIPs.has(newIpAddress) && uniqueIPs.size >= this.config.ipAnomalyThreshold) {
        logger.security(
          'IP_ANOMALY_DETECTED',
          'MEDIUM',
          {
            userId,
            newIpAddress,
            knownIPs: Array.from(uniqueIPs)
          }
        );

        // Log to security events
        await this.logSecurityEvent(
          'suspicious_activity',
          'medium',
          userId,
          newIpAddress,
          {
            type: 'ip_anomaly',
            newIp: newIpAddress,
            knownIPs: Array.from(uniqueIPs)
          }
        );

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in detectIPAnomaly', error);
      return false;
    }
  }

  /**
   * Detect unusual access patterns
   */
  static async detectUnusualAccessPattern(
    userId: string,
    action: string,
    resourceType: string
  ): Promise<boolean> {
    try {
      const windowStart = new Date(Date.now() - 60 * 60 * 1000); // Last hour
      
      // Check for unusual volume of requests
      const { count, error } = await supabase
        .from('security_audit_logs')
        .select('count')
        .eq('user_id', userId)
        .eq('resource_type', resourceType)
        .gte('timestamp', windowStart.toISOString());

      if (error) {
        logger.error('Failed to check access pattern', error);
        return false;
      }

      if ((count || 0) >= this.config.unusualAccessThreshold) {
        logger.security(
          'UNUSUAL_ACCESS_PATTERN',
          'MEDIUM',
          {
            userId,
            action,
            resourceType,
            requestCount: count,
            threshold: this.config.unusualAccessThreshold
          }
        );

        // Log to security events
        await this.logSecurityEvent(
          'suspicious_activity',
          'medium',
          userId,
          undefined,
          {
            type: 'unusual_access_pattern',
            action,
            resourceType,
            requestCount: count
          }
        );

        return true;
      }

      // Check for access at unusual times
      const currentHour = new Date().getHours();
      const isUnusualTime = currentHour >= 2 && currentHour <= 5; // 2 AM - 5 AM

      if (isUnusualTime && resourceType === 'card' && action.includes('view_details')) {
        logger.security(
          'UNUSUAL_TIME_ACCESS',
          'LOW',
          {
            userId,
            action,
            resourceType,
            hour: currentHour
          }
        );

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in detectUnusualAccessPattern', error);
      return false;
    }
  }

  /**
   * Check for concurrent session anomaly
   */
  static async detectConcurrentSessionAnomaly(userId: string, sessionId: string): Promise<boolean> {
    try {
      // Get active sessions for user
      const { data: sessions, error } = await supabase
        .from('user_sessions')
        .select('id, ip_address, user_agent, created_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .neq('id', sessionId);

      if (error) {
        logger.error('Failed to check concurrent sessions', error);
        return false;
      }

      if (sessions && sessions.length > 2) {
        logger.security(
          'MULTIPLE_CONCURRENT_SESSIONS',
          'MEDIUM',
          {
            userId,
            currentSessionId: sessionId,
            activeSessions: sessions.length + 1
          }
        );

        // Log to security events
        await this.logSecurityEvent(
          'suspicious_activity',
          'medium',
          userId,
          undefined,
          {
            type: 'concurrent_sessions',
            sessionCount: sessions.length + 1
          }
        );

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in detectConcurrentSessionAnomaly', error);
      return false;
    }
  }

  /**
   * Run all anomaly detection checks
   */
  static async runAnomalyChecks(
    req: Request,
    userId?: string,
    action?: string,
    resourceType?: string
  ): Promise<{
    anomaliesDetected: boolean;
    anomalies: string[];
  }> {
    const anomalies: string[] = [];
    const ipAddress = SecurityLoggingService.getClientIp(req);

    try {
      // Check brute force
      if (await this.detectBruteForce(ipAddress)) {
        anomalies.push('brute_force');
      }

      if (userId) {
        // Check failed login attempts
        if (await this.checkFailedLoginAttempts(userId, ipAddress)) {
          anomalies.push('failed_login_threshold');
        }

        // Check IP anomaly
        if (await this.detectIPAnomaly(userId, ipAddress)) {
          anomalies.push('ip_anomaly');
        }

        // Check unusual access pattern
        if (action && resourceType) {
          if (await this.detectUnusualAccessPattern(userId, action, resourceType)) {
            anomalies.push('unusual_access_pattern');
          }
        }

        // Check concurrent sessions
        const sessionId = (req as any).sessionId;
        if (sessionId) {
          if (await this.detectConcurrentSessionAnomaly(userId, sessionId)) {
            anomalies.push('concurrent_sessions');
          }
        }
      }

      return {
        anomaliesDetected: anomalies.length > 0,
        anomalies
      };
    } catch (error) {
      logger.error('Error running anomaly checks', error);
      return {
        anomaliesDetected: false,
        anomalies: []
      };
    }
  }

  /**
   * Update configuration
   */
  static updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Anomaly detection config updated', this.config);
  }

  /**
   * Get current configuration
   */
  static getConfig(): AnomalyDetectionConfig {
    return { ...this.config };
  }

  /**
   * Log security event to database
   */
  private static async logSecurityEvent(
    eventType: string,
    severity: string,
    userId?: string,
    ipAddress?: string,
    details?: any
  ): Promise<void> {
    try {
      await supabase
        .from('security_alerts')
        .insert({
          type: 'anomaly',
          severity: severity.toUpperCase(),
          title: `Anomaly Detected: ${eventType}`,
          message: `Security anomaly of type ${eventType} detected`,
          details: details || {},
          user_id: userId,
          ip_address: ipAddress
        });
    } catch (error) {
      logger.error('Failed to log security event', error);
    }
  }
}