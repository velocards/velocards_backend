import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { RequestSigningService } from '../../services/requestSigningService';
import { sendError } from '../../utils/responseFormatter';
import logger from '../../utils/logger';
import { env } from '../../config/env';

// Endpoints that require request signing
const SIGNED_ENDPOINTS = [
  '/api/v1/cards/*/freeze',
  '/api/v1/cards/*/unfreeze',
  '/api/v1/cards/*/delete',
  '/api/v1/crypto/withdraw',
  '/api/v1/users/settings/security',
  '/api/v1/payments/*'
];

// Check if endpoint requires signing
function requiresSigning(path: string): boolean {
  return SIGNED_ENDPOINTS.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]+') + '$');
    return regex.test(path);
  });
}

/**
 * Middleware to validate request signatures for sensitive operations
 */
export async function validateRequestSignature(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip signature validation in development/test
  if (env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Check if this endpoint requires signing
  if (!requiresSigning(req.path)) {
    return next();
  }
  
  // Skip if no user (unauthenticated requests)
  if (!req.user) {
    return next();
  }
  
  try {
    // Get user's API secret (would be stored in user profile or separate table)
    // For now, we'll use a derived secret based on user ID
    // In production, each user should have their own API secret
    const userSecret = getUserApiSecret(req.user.id);
    
    // Validate signature
    const isValid = await RequestSigningService.validateSignature(
      req,
      userSecret,
      {
        expirySeconds: 300, // 5 minutes
        includeBody: true
      }
    );
    
    if (!isValid) {
      logger.warn('Invalid request signature', {
        userId: req.user.id,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      sendError(res, 'INVALID_SIGNATURE', 'Invalid request signature', 401);
      return;
    }
    
    next();
  } catch (error: any) {
    logger.error('Request signature validation error:', error);
    
    if (error.message.includes('expired')) {
      sendError(res, 'SIGNATURE_EXPIRED', 'Request signature has expired', 401);
    } else if (error.message.includes('Duplicate')) {
      sendError(res, 'DUPLICATE_REQUEST', 'Duplicate request detected', 401);
    } else {
      sendError(res, 'SIGNATURE_VALIDATION_ERROR', 'Request signature validation failed', 401);
    }
  }
}

/**
 * Get user's API secret for request signing
 * In production, this should fetch from database
 */
function getUserApiSecret(userId: string): string {
  // TODO: Implement proper API secret management
  // For now, derive from user ID and app secret
  const appSecret = process.env['JWT_ACCESS_SECRET'] || 'default-secret';
  return `${appSecret}:${userId}`;
}

/**
 * Middleware to enforce request signing on specific routes
 */
export function requireRequestSignature(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Always require signature for this specific route
  const originalRequiresSigning = requiresSigning;
  (global as any).requiresSigning = () => true;
  
  validateRequestSignature(req, res, () => {
    (global as any).requiresSigning = originalRequiresSigning;
    next();
  });
}

/**
 * Helper to generate signature headers for testing
 */
export function generateTestSignatureHeaders(
  method: string,
  path: string,
  body: any,
  userId: string
): Record<string, string> {
  const secret = getUserApiSecret(userId);
  return RequestSigningService.generateSignatureHeaders(
    method,
    path,
    body,
    secret
  );
}