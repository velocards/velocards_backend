import { Response, NextFunction } from 'express';
import { CSRFService } from '../../services/csrfService';
import { AuthRequest } from './auth';
import { sendError } from '../../utils/responseFormatter';
import logger from '../../utils/logger';

// Whitelist of safe methods that don't require CSRF protection
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Whitelist of endpoints that don't require CSRF protection
const CSRF_EXEMPT_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/google',
  '/api/v1/auth/google/callback',
  '/webhooks', // Webhook endpoints have their own signature validation
  '/api/v1/kyc/webhook'
];

/**
 * CSRF Protection Middleware
 * Validates CSRF tokens on state-changing requests
 */
export async function csrfProtection(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip CSRF check for safe methods
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for exempt paths
  const isExempt = CSRF_EXEMPT_PATHS.some(path => req.path.startsWith(path));
  if (isExempt) {
    return next();
  }

  // Skip if no user (unauthenticated requests)
  if (!req.user) {
    return next();
  }

  try {
    // Get CSRF token from header
    const headerToken = req.headers['x-csrf-token'] as string;
    
    // Try session-based validation first
    const isValid = await CSRFService.validateToken(req.user.sessionId, headerToken);
    
    if (!isValid) {
      // Fallback to double-submit cookie pattern
      const cookieToken = (req as any).cookies?.csrf_token;
      
      if (!CSRFService.validateDoubleSubmit(headerToken, cookieToken)) {
        logger.warn(`CSRF validation failed for user ${req.user.email}`, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        sendError(res, 'CSRF_VALIDATION_FAILED', 'Invalid CSRF token', 403);
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('CSRF validation error:', error);
    sendError(res, 'CSRF_VALIDATION_ERROR', 'CSRF validation failed', 403);
  }
}

/**
 * Generate CSRF token endpoint handler
 */
export async function generateCSRFToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    const token = await CSRFService.generateToken(req.user.sessionId);
    
    // Set token as cookie for double-submit pattern
    res.cookie('csrf_token', token, {
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour
      httpOnly: false // Must be readable by JavaScript for double-submit
    });

    res.json({
      success: true,
      data: { csrfToken: token }
    });
  } catch (error) {
    next(error);
  }
}