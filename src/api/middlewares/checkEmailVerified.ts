import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRepository } from '../../repositories/userRepository';
import { sendError } from '../../utils/responseFormatter';
import logger from '../../utils/logger';

/**
 * Middleware to check if user's email is verified
 * Can be configured to either block or warn
 */
// Extend AuthRequest to include email verification warning
declare module './auth' {
  interface AuthRequest {
    emailVerificationWarning?: {
      message: string;
      email_verified: boolean;
    };
  }
}

export function checkEmailVerified(options: { blockUnverified?: boolean } = {}) {
  const { blockUnverified = true } = options;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        return;
      }

      const user = await UserRepository.findById(req.user.id);
      if (!user) {
        sendError(res, 'NOT_FOUND', 'User not found', 404);
        return;
      }

      if (!user.email_verified) {
        logger.info(`Unverified email access attempt by user ${user.email}`);
        
        if (blockUnverified) {
          sendError(
            res, 
            'EMAIL_NOT_VERIFIED', 
            'Please verify your email address to access this feature. Check your email for the verification link.', 
            403,
            {
              email_verified: false,
              email: user.email
            }
          );
          return;
        } else {
          // Just add a warning to the request
          req.emailVerificationWarning = {
            message: 'Your email is not verified. Some features may be limited.',
            email_verified: false
          };
        }
      }

      next();
    } catch (error) {
      logger.error('Error checking email verification:', error);
      next(error);
    }
  };
}

// Convenience exports
export const requireEmailVerified = checkEmailVerified({ blockUnverified: true });
export const warnEmailUnverified = checkEmailVerified({ blockUnverified: false });