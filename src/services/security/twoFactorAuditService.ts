import { supabase } from '../../config/database';
import { Request } from 'express';

export interface TwoFactorAuditEvent {
  userId: string;
  eventType: '2fa_setup' | '2fa_enabled' | '2fa_disabled' | '2fa_verified' | '2fa_failed' | 'backup_code_used' | 'backup_codes_regenerated' | 'recovery_initiated' | 'recovery_completed' | 'suspicious_activity';
  eventDetails: {
    success: boolean;
    method?: 'totp' | 'backup_code' | 'recovery_token';
    failureReason?: string | undefined;
    backupCodesRemaining?: number | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    deviceFingerprint?: string | undefined;
    anomalyDetails?: string | undefined;
  };
  metadata?: Record<string, any>;
}

export class TwoFactorAuditService {
  
  static async logEvent(event: TwoFactorAuditEvent): Promise<void> {
    try {
      await supabase
        .from('two_factor_audit_logs')
        .insert({
          user_id: event.userId,
          event_type: event.eventType,
          event_category: 'two_factor_authentication',
          event_details: event.eventDetails,
          ip_address: event.eventDetails.ipAddress,
          user_agent: event.eventDetails.userAgent,
          metadata: event.metadata || {},
          timestamp: new Date().toISOString()
        });

      // Log to console for immediate visibility
      console.log(`2FA Audit: ${event.eventType} for user ${event.userId} - Success: ${event.eventDetails.success}`);
    } catch (error) {
      console.error('Failed to log 2FA audit event:', error);
    }
  }

  static async logSetupAttempt(userId: string, req: Request, success: boolean, failureReason?: string): Promise<void> {
    await this.logEvent({
      userId,
      eventType: '2fa_setup',
      eventDetails: {
        success,
        failureReason,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });
  }

  static async logEnableAttempt(userId: string, req: Request, success: boolean, failureReason?: string): Promise<void> {
    await this.logEvent({
      userId,
      eventType: '2fa_enabled',
      eventDetails: {
        success,
        method: 'totp',
        failureReason,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });
  }

  static async logDisableAttempt(userId: string, req: Request, success: boolean, failureReason?: string): Promise<void> {
    await this.logEvent({
      userId,
      eventType: '2fa_disabled',
      eventDetails: {
        success,
        failureReason,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });
  }

  static async logVerificationAttempt(
    userId: string, 
    req: Request, 
    success: boolean, 
    method: 'totp' | 'backup_code' = 'totp',
    backupCodesRemaining?: number,
    failureReason?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: success ? '2fa_verified' : '2fa_failed',
      eventDetails: {
        success,
        method,
        failureReason,
        backupCodesRemaining,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });
  }

  static async logBackupCodeUsed(userId: string, req: Request, codesRemaining: number): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'backup_code_used',
      eventDetails: {
        success: true,
        method: 'backup_code',
        backupCodesRemaining: codesRemaining,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });
  }

  static async logBackupCodesRegenerated(userId: string, req: Request): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'backup_codes_regenerated',
      eventDetails: {
        success: true,
        backupCodesRemaining: 10, // Always 10 new codes
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      }
    });
  }

  static async logRecoveryInitiated(userId: string, email: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'recovery_initiated',
      eventDetails: {
        success: true,
        ipAddress,
        userAgent
      },
      metadata: {
        email,
        initiatedAt: new Date().toISOString()
      }
    });
  }

  static async logRecoveryCompleted(userId: string, method: 'token_verification' | 'disable_2fa', ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'recovery_completed',
      eventDetails: {
        success: true,
        method: method === 'token_verification' ? 'recovery_token' : 'recovery_token',
        ipAddress,
        userAgent
      },
      metadata: {
        recoveryMethod: method,
        completedAt: new Date().toISOString()
      }
    });
  }

  static async logSuspiciousActivity(
    userId: string, 
    anomalyType: 'rapid_location_change' | 'multiple_devices' | 'unusual_timing' | 'repeated_failures',
    details: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      eventType: 'suspicious_activity',
      eventDetails: {
        success: false, // Suspicious activity is flagged as concerning
        anomalyDetails: details,
        ipAddress,
        userAgent
      },
      metadata: {
        anomalyType,
        flaggedAt: new Date().toISOString(),
        severity: 'medium'
      }
    });
  }

  // Analytics methods for security monitoring
  static async getRecentFailedAttempts(userId: string, minutesBack: number = 60): Promise<number> {
    try {
      const since = new Date(Date.now() - minutesBack * 60 * 1000).toISOString();
      
      const { count, error } = await supabase
        .from('two_factor_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('event_category', 'two_factor_authentication')
        .in('event_type', ['2fa_failed'])
        .gte('timestamp', since);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Failed to get recent failed attempts:', error);
      return 0;
    }
  }

  static async getSetupActivity(hoursBack: number = 24): Promise<any[]> {
    try {
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('two_factor_audit_logs')
        .select('user_id, event_type, event_details, timestamp')
        .eq('event_category', 'two_factor_authentication')
        .in('event_type', ['2fa_setup', '2fa_enabled', '2fa_disabled'])
        .gte('timestamp', since)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get setup activity:', error);
      return [];
    }
  }

  static async detectAnomalousPatterns(userId: string): Promise<boolean> {
    try {
      // Check for multiple failures in short time
      const recentFailures = await this.getRecentFailedAttempts(userId, 15);
      if (recentFailures >= 5) {
        await this.logSuspiciousActivity(
          userId,
          'repeated_failures',
          `${recentFailures} failed 2FA attempts in 15 minutes`
        );
        return true;
      }

      // Check for unusual activity patterns
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('two_factor_audit_logs')
        .select('event_details, timestamp')
        .eq('user_id', userId)
        .eq('event_category', 'two_factor_authentication')
        .gte('timestamp', since)
        .order('timestamp', { ascending: false });

      if (error || !data || data.length < 2) return false;

      // Check for rapid location changes
      const ipAddresses = new Set();
      let rapidLocationChange = false;
      
      for (let i = 0; i < Math.min(data.length, 10); i++) {
        const event = data[i];
        if (event.event_details?.ipAddress) {
          ipAddresses.add(event.event_details.ipAddress);
        }
        
        // Check if multiple different IPs in short time
        if (i > 0 && ipAddresses.size > 3) {
          const timeDiff = new Date(data[0].timestamp).getTime() - new Date(event.timestamp).getTime();
          if (timeDiff < 30 * 60 * 1000) { // 30 minutes
            rapidLocationChange = true;
            break;
          }
        }
      }

      if (rapidLocationChange) {
        await this.logSuspiciousActivity(
          userId,
          'rapid_location_change',
          `Multiple IP addresses detected in short timeframe: ${Array.from(ipAddresses).join(', ')}`
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to detect anomalous patterns:', error);
      return false;
    }
  }
}