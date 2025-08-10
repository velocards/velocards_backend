import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/database';
import logger from '../utils/logger';
import { Request } from 'express';
import { AuthRequest } from '../api/middlewares/auth';

export interface AuditLog {
  id?: string;
  timestamp: Date;
  user_id?: string;
  session_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  result: 'success' | 'failure';
  error_code?: string;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  request_method?: string;
  request_path?: string;
  request_body?: any;
  response_status?: number;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

export interface SecurityEvent {
  event_type: 'failed_login' | 'suspicious_activity' | 'permission_denied' | 'rate_limit_exceeded' | 'invalid_signature' |
    'brute_force_detected' | 'ip_anomaly' | 'unusual_access_pattern' | 'concurrent_sessions' | 'data_export';
  severity: 'low' | 'medium' | 'high' | 'critical';
  user_id?: string;
  ip_address?: string;
  details: Record<string, any>;
}

export type EventCategory = 'AUTH' | 'ACCESS' | 'MODIFICATION' | 'ANOMALY';
export type EventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export class AuditService {
  // Event type categorization
  private static eventCategories: Record<string, EventCategory> = {
    'auth.login': 'AUTH',
    'auth.logout': 'AUTH',
    'auth.register': 'AUTH',
    'auth.password_reset': 'AUTH',
    'auth.password_change': 'AUTH',
    'auth.2fa_enabled': 'AUTH',
    'auth.2fa_disabled': 'AUTH',
    'card.create': 'MODIFICATION',
    'card.update': 'MODIFICATION',
    'card.delete': 'MODIFICATION',
    'card.view': 'ACCESS',
    'card.view_details': 'ACCESS',
    'card.freeze': 'MODIFICATION',
    'card.unfreeze': 'MODIFICATION',
    'financial.deposit': 'MODIFICATION',
    'financial.withdraw': 'MODIFICATION',
    'financial.transfer': 'MODIFICATION',
    'financial.payment': 'MODIFICATION',
    'user.update': 'MODIFICATION',
    'user.delete': 'MODIFICATION',
    'settings.changed': 'MODIFICATION',
    'data.export': 'ACCESS',
    'api.call': 'ACCESS',
    'rate_limit.exceeded': 'ANOMALY',
    'security.brute_force': 'ANOMALY',
    'security.ip_anomaly': 'ANOMALY',
    'security.unusual_pattern': 'ANOMALY'
  };

  // Severity assignment based on event type
  private static eventSeverity: Record<string, EventSeverity> = {
    'auth.login_failed': 'MEDIUM',
    'auth.password_reset': 'MEDIUM',
    'auth.2fa_disabled': 'HIGH',
    'card.view_details': 'LOW',
    'card.delete': 'HIGH',
    'financial.withdraw': 'HIGH',
    'financial.transfer': 'HIGH',
    'user.delete': 'CRITICAL',
    'data.export': 'MEDIUM',
    'rate_limit.exceeded': 'MEDIUM',
    'security.brute_force': 'CRITICAL',
    'security.ip_anomaly': 'MEDIUM',
    'security.unusual_pattern': 'HIGH'
  };
  /**
   * Get event category
   */
  static getEventCategory(action: string): EventCategory {
    return this.eventCategories[action] || 'ACCESS';
  }

  /**
   * Get event severity
   */
  static getEventSeverity(action: string): EventSeverity {
    return this.eventSeverity[action] || 'LOW';
  }

  /**
   * Log an audit event with enhanced metadata
   */
  static async log(auditLog: Partial<AuditLog>): Promise<void> {
    try {
      const log: AuditLog = {
        id: uuidv4(),
        timestamp: new Date(),
        result: 'success',
        action: '',
        ...auditLog
      } as AuditLog;
      
      // Add event categorization to metadata
      const enhancedMetadata = {
        ...log.metadata,
        event_category: this.getEventCategory(log.action),
        event_severity: this.getEventSeverity(log.action)
      };

      // Insert into database
      const { error } = await supabase
        .from('security_audit_logs')
        .insert({
          ...log,
          request_body: log.request_body ? JSON.stringify(log.request_body) : null,
          metadata: JSON.stringify(enhancedMetadata)
        });
      
      if (error) {
        logger.error('Failed to insert audit log', { error, log });
      }
      
      // Also log to file for backup
      logger.info('AUDIT', log);
    } catch (error) {
      logger.error('Audit logging failed', error);
    }
  }
  
  /**
   * Log a security event
   */
  static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_events')
        .insert({
          id: uuidv4(),
          timestamp: new Date(),
          ...event,
          details: JSON.stringify(event.details)
        });
      
      if (error) {
        logger.error('Failed to insert security event', { error, event });
      }
      
      // Log high severity events with alert
      if (event.severity === 'high' || event.severity === 'critical') {
        logger.error(`SECURITY ALERT: ${event.event_type}`, event);
        // TODO: Send alerts to security team
      } else {
        logger.warn(`Security Event: ${event.event_type}`, event);
      }
    } catch (error) {
      logger.error('Security event logging failed', error);
    }
  }
  
  /**
   * Create audit log from request
   */
  static createAuditLogFromRequest(
    req: Request | AuthRequest,
    action: string,
    resourceType?: string,
    resourceId?: string
  ): Partial<AuditLog> {
    const authReq = req as AuthRequest;
    
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    
    return {
      ...(authReq.user?.id && { user_id: authReq.user.id }),
      ...(authReq.user?.sessionId && { session_id: authReq.user.sessionId }),
      action,
      ...(resourceType && { resource_type: resourceType }),
      ...(resourceId && { resource_id: resourceId }),
      ...(ipAddress && { ip_address: ipAddress }),
      ...(userAgent && { user_agent: userAgent }),
      ...((req as any).id && { request_id: (req as any).id }),
      request_method: req.method,
      request_path: req.originalUrl || req.path,
      request_body: this.sanitizeRequestBody(req.body)
    };
  }
  
  /**
   * Sanitize request body for logging (remove sensitive data)
   */
  private static sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }
    
    const sensitiveFields = [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'token',
      'refreshToken',
      'accessToken',
      'apiKey',
      'secret',
      'pan',
      'cvv',
      'cardNumber',
      'securityCode'
    ];
    
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Log authentication events
   */
  static async logAuthEvent(
    action: 'login' | 'logout' | 'register' | 'password_reset' | 'password_change',
    userId: string | undefined,
    success: boolean,
    req: Request,
    errorMessage?: string
  ): Promise<void> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    
    await this.log({
      action: `auth.${action}`,
      ...(userId && { user_id: userId }),
      result: success ? 'success' : 'failure',
      ...(errorMessage && { error_message: errorMessage }),
      ...(ipAddress && { ip_address: ipAddress }),
      ...(userAgent && { user_agent: userAgent }),
      metadata: {
        action_type: action
      }
    });
    
    // Log security event for failed logins
    if (action === 'login' && !success) {
      await this.logSecurityEvent({
        event_type: 'failed_login',
        severity: 'medium',
        ...(userId && { user_id: userId }),
        ...(ipAddress && { ip_address: ipAddress }),
        details: {
          ...(userAgent && { user_agent: userAgent }),
          ...(errorMessage && { error: errorMessage })
        }
      });
    }
  }
  
  /**
   * Log card operations
   */
  static async logCardOperation(
    action: 'create' | 'view' | 'update' | 'delete' | 'freeze' | 'unfreeze' | 'view_details',
    cardId: string,
    userId: string,
    success: boolean,
    req: Request,
    metadata?: Record<string, any>
  ): Promise<void> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    
    await this.log({
      action: `card.${action}`,
      resource_type: 'card',
      resource_id: cardId,
      user_id: userId,
      result: success ? 'success' : 'failure',
      ...(ipAddress && { ip_address: ipAddress }),
      ...(userAgent && { user_agent: userAgent }),
      metadata: {
        ...metadata,
        sensitive_operation: ['view_details', 'create'].includes(action)
      }
    });
  }
  
  /**
   * Log financial transactions
   */
  static async logFinancialOperation(
    action: 'deposit' | 'withdraw' | 'transfer' | 'payment',
    userId: string,
    amount: number,
    currency: string,
    success: boolean,
    req: Request,
    metadata?: Record<string, any>
  ): Promise<void> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    
    await this.log({
      action: `financial.${action}`,
      resource_type: 'transaction',
      user_id: userId,
      result: success ? 'success' : 'failure',
      ...(ipAddress && { ip_address: ipAddress }),
      ...(userAgent && { user_agent: userAgent }),
      metadata: {
        amount,
        currency,
        ...metadata
      }
    });
  }
  
  /**
   * Query audit logs
   */
  static async queryLogs(filters: {
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    result?: 'success' | 'failure';
    limit?: number;
  }): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('security_audit_logs')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      
      if (filters.resourceType) {
        query = query.eq('resource_type', filters.resourceType);
      }
      
      if (filters.resourceId) {
        query = query.eq('resource_id', filters.resourceId);
      }
      
      if (filters.result) {
        query = query.eq('result', filters.result);
      }
      
      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }
      
      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }
      
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      
      const { data, error } = await query;
      
      if (error) {
        logger.error('Failed to query audit logs', { error, filters });
        return [];
      }
      
      return data || [];
    } catch (error) {
      logger.error('Error querying audit logs', error);
      return [];
    }
  }
  
  /**
   * Generate audit report
   */
  static async generateAuditReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: Record<string, number>;
    logs: AuditLog[];
  }> {
    const logs = await this.queryLogs({
      userId,
      startDate,
      endDate
    });
    
    // Generate summary
    const summary: Record<string, number> = {};
    
    for (const log of logs) {
      const key = `${log.action}_${log.result}`;
      summary[key] = (summary[key] || 0) + 1;
    }
    
    return { summary, logs };
  }
}