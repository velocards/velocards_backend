import { Response, NextFunction } from 'express';
import { Permission, roleHasAllPermissions, roleHasAnyPermission, UserRole } from '../../config/roles';
import { ForbiddenError } from '../../utils/errors';
import { AuthRequest } from './auth';
import logger from '../../utils/logger';

/**
 * Authorization middleware factory
 * Checks if the authenticated user has the required permissions
 * 
 * @param requiredPermissions - Single permission or array of permissions required
 * @param requireAll - If true, user must have ALL permissions. If false, ANY permission is sufficient
 * @returns Express middleware function
 */
export function authorize(
  requiredPermissions: Permission | Permission[],
  requireAll: boolean = true
): (req: AuthRequest, res: Response, next: NextFunction) => void {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req as any).id
          }
        });
        return;
      }

      const { role, permissions: userPermissions } = req.user;

      // Check if user has a valid role
      if (!role) {
        logger.error('User missing role', { userId: req.user.sub });
        throw new ForbiddenError('User role not assigned');
      }

      // Convert single permission to array for consistency
      const permissionsToCheck = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

      // Check permissions
      let hasPermission = false;

      if (userPermissions && userPermissions.length > 0) {
        // Use permissions from JWT if available
        hasPermission = requireAll
          ? permissionsToCheck.every(p => userPermissions.includes(p))
          : permissionsToCheck.some(p => userPermissions.includes(p));
      } else {
        // Fall back to role-based permission check
        hasPermission = requireAll
          ? roleHasAllPermissions(role, permissionsToCheck)
          : roleHasAnyPermission(role, permissionsToCheck);
      }

      if (!hasPermission) {
        logger.warn('Authorization failed', {
          userId: req.user.sub,
          role,
          requiredPermissions: permissionsToCheck,
          requireAll,
          path: req.path,
          method: req.method
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to access this resource'
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req as any).id
          }
        });
        return;
      }

      // User has required permissions, proceed
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Shorthand middleware for admin-only routes
 */
export const adminOnly = authorize([UserRole.ADMIN] as any, true);

/**
 * Check if user owns the resource they're trying to access
 * This is for resource-based authorization (e.g., can only edit own profile)
 */
export function authorizeOwnership(
  resourceUserIdExtractor: (req: AuthRequest) => string | undefined
): (req: AuthRequest, res: Response, next: NextFunction) => void {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req as any).id
          }
        });
        return;
      }

      const resourceUserId = resourceUserIdExtractor(req);
      
      if (!resourceUserId) {
        throw new ForbiddenError('Resource not found');
      }

      // Admins can access any resource
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }

      // Check if user owns the resource
      if (req.user.sub !== resourceUserId) {
        logger.warn('Ownership authorization failed', {
          userId: req.user.sub,
          resourceUserId,
          path: req.path,
          method: req.method
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only access your own resources'
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: (req as any).id
          }
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Combine multiple authorization checks
 * All checks must pass for the request to proceed
 */
export function combineAuthorizations(
  ...authorizations: Array<(req: AuthRequest, res: Response, next: NextFunction) => void>
): (req: AuthRequest, res: Response, next: NextFunction) => void {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    for (const authCheck of authorizations) {
      await new Promise<void>((resolve, reject) => {
        authCheck(req, res, (err?: any) => {
          if (err) reject(err);
          else resolve();
        });
      }).catch(next);
      
      // If response was sent by any auth check, stop processing
      if (res.headersSent) {
        return;
      }
    }
    next();
  };
}