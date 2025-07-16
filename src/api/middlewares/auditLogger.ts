import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AuditService } from '../../services/auditService';
import logger from '../../utils/logger';

// Actions that should be logged
const AUDITABLE_ACTIONS: Record<string, string> = {
  // Auth
  'POST /api/v1/auth/login': 'auth.login',
  'POST /api/v1/auth/register': 'auth.register',
  'POST /api/v1/auth/logout': 'auth.logout',
  'POST /api/v1/auth/forgot-password': 'auth.password_reset_request',
  'POST /api/v1/auth/reset-password': 'auth.password_reset',
  
  // Cards
  'POST /api/v1/cards': 'card.create',
  'GET /api/v1/cards/:cardId': 'card.view',
  'GET /api/v1/cards/:cardId/full-details': 'card.view_sensitive',
  'POST /api/v1/cards/:cardId/session': 'card.create_secure_session',
  'POST /api/v1/cards/secure/details': 'card.view_secure_details',
  'PUT /api/v1/cards/:cardId/freeze': 'card.freeze',
  'PUT /api/v1/cards/:cardId/unfreeze': 'card.unfreeze',
  'DELETE /api/v1/cards/:cardId': 'card.delete',
  'PUT /api/v1/cards/:cardId/limits': 'card.update_limits',
  
  // Transactions
  'GET /api/v1/transactions': 'transaction.list',
  'GET /api/v1/transactions/:transactionId': 'transaction.view',
  'POST /api/v1/transactions/:transactionId/dispute': 'transaction.dispute',
  
  // Crypto
  'POST /api/v1/crypto/deposit/order': 'crypto.deposit_order',
  'POST /api/v1/crypto/withdraw': 'crypto.withdraw',
  
  // User
  'PUT /api/v1/users/profile': 'user.update_profile',
  'PUT /api/v1/users/settings': 'user.update_settings',
  'POST /api/v1/users/kyc/submit': 'user.kyc_submit',
  
  // Admin
  'GET /api/v1/admin/*': 'admin.access',
  'POST /api/v1/admin/*': 'admin.modify',
  'PUT /api/v1/admin/*': 'admin.modify',
  'DELETE /api/v1/admin/*': 'admin.delete'
};

/**
 * Get action name from request
 */
function getActionName(method: string, path: string): string | null {
  // Direct match
  const key = `${method} ${path}`;
  if (AUDITABLE_ACTIONS[key]) {
    return AUDITABLE_ACTIONS[key];
  }
  
  // Pattern matching for parameterized routes
  for (const [pattern, action] of Object.entries(AUDITABLE_ACTIONS)) {
    const parts = pattern.split(' ');
    if (parts.length !== 2) continue;
    const [patternMethod, patternPath] = parts;
    
    if (method !== patternMethod || !patternPath) continue;
    
    // Convert pattern to regex
    const regexPattern = patternPath
      .replace(/:[^/]+/g, '[^/]+') // Replace :param with regex
      .replace(/\*/g, '.*'); // Replace * with regex
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    if (regex.test(path)) {
      return action;
    }
  }
  
  return null;
}

/**
 * Extract resource info from request
 */
function extractResourceInfo(req: AuthRequest): { type?: string; id?: string } {
  const path = req.path;
  
  // Card operations
  if (path.includes('/cards/')) {
    const cardId = req.params['cardId'];
    return {
      type: 'card',
      ...(cardId && { id: cardId })
    };
  }
  
  // Transaction operations
  if (path.includes('/transactions/')) {
    const transactionId = req.params['transactionId'];
    return {
      type: 'transaction',
      ...(transactionId && { id: transactionId })
    };
  }
  
  // User operations
  if (path.includes('/users/')) {
    const userId = req.user?.id;
    return {
      type: 'user',
      ...(userId && { id: userId })
    };
  }
  
  return {};
}

/**
 * Audit logging middleware
 */
export function auditLogger() {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Capture response
    let responseData: any;
    let responded = false;
    
    res.send = function(data: any) {
      if (!responded) {
        responded = true;
        responseData = data;
        logAuditEvent();
      }
      return originalSend.call(this, data);
    };
    
    res.json = function(data: any) {
      if (!responded) {
        responded = true;
        responseData = data;
        logAuditEvent();
      }
      return originalJson.call(this, data);
    };
    
    // Log audit event
    async function logAuditEvent() {
      try {
        const duration = Date.now() - startTime;
        const action = getActionName(req.method, req.path);
        
        if (!action) {
          // Not an auditable action
          return;
        }
        
        const { type, id } = extractResourceInfo(req);
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400;
        
        // Parse response for error details
        let errorCode: string | undefined;
        let errorMessage: string | undefined;
        
        if (!success && responseData) {
          try {
            const parsed = typeof responseData === 'string' 
              ? JSON.parse(responseData) 
              : responseData;
            
            if (parsed.error) {
              errorCode = parsed.error.code;
              errorMessage = parsed.error.message;
            }
          } catch {
            // Ignore parse errors
          }
        }
        
        // Create audit log
        await AuditService.log({
          ...AuditService.createAuditLogFromRequest(req, action, type, id),
          result: success ? 'success' : 'failure',
          ...(errorCode && { error_code: errorCode }),
          ...(errorMessage && { error_message: errorMessage }),
          response_status: statusCode,
          duration_ms: duration
        });
        
        // Log specific events
        if (action.startsWith('auth.')) {
          const userId = req.user?.id || req.body?.email;
          await AuditService.logAuthEvent(
            action.split('.')[1] as any,
            userId,
            success,
            req,
            errorMessage
          );
        } else if (action.startsWith('card.') && id) {
          await AuditService.logCardOperation(
            action.split('.')[1] as any,
            id,
            req.user!.id,
            success,
            req
          );
        }
        
      } catch (error) {
        logger.error('Failed to log audit event', error);
      }
    }
    
    next();
  };
}

/**
 * Security event logger for middleware errors
 */
export function logSecurityEvent(
  eventType: 'permission_denied' | 'rate_limit_exceeded' | 'invalid_signature',
  req: AuthRequest,
  details: Record<string, any>
): void {
  const eventData: any = {
    event_type: eventType,
    severity: eventType === 'invalid_signature' ? 'high' : 'medium',
    details: {
      path: req.path,
      method: req.method,
      user_agent: req.get('user-agent'),
      ...details
    }
  };
  
  if (req.user?.id) {
    eventData.user_id = req.user.id;
  }
  
  const ipAddress = req.ip || req.socket.remoteAddress;
  if (ipAddress) {
    eventData.ip_address = ipAddress;
  }
  
  AuditService.logSecurityEvent(eventData).catch(error => {
    logger.error('Failed to log security event', error);
  });
}