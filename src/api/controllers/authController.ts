import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/userService';
import { TokenService } from '../../services/tokenService';
import { UserRepository } from '../../repositories/userRepository';
import { PasswordResetService } from '../../services/passwordResetService';
import { EmailVerificationService } from '../../services/emailVerificationService';
import { GoogleOAuthService } from '../../services/googleOAuthService';
import { CaptchaService } from '../../services/captchaService';
import { CSRFService } from '../../services/csrfService';
import { sendSuccess, sendError } from '../../utils/responseFormatter';
import { RegisterInput, LoginInput, RefreshTokenInput, ForgotPasswordInput, ResetPasswordInput } from '../validators/authValidators';
import { AuthRequest } from '../middlewares/auth';
import { UserRole } from '../../config/roles';
import { features, env } from '../../config/env';
import logger from '../../utils/logger';

export class AuthController {
  static async register(req: Request<{}, {}, RegisterInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!features.enableRegistration) {
        sendError(res, 'REGISTRATION_DISABLED', 'Registration is currently disabled', 403);
        return;
      }

      // Verify CAPTCHA if provided or required
      if (CaptchaService.isRequired('register') || req.body.captchaToken) {
        if (!req.body.captchaToken) {
          sendError(res, 'CAPTCHA_REQUIRED', 'CAPTCHA verification is required', 400);
          return;
        }
        
        const clientIp = req.ip || req.socket.remoteAddress;
        await CaptchaService.verify(req.body.captchaToken, clientIp);
      }

      const result = await UserService.register(req.body, req);
      
      // Send verification email
      try {
        await EmailVerificationService.sendVerificationEmail(result.user.id);
      } catch (error) {
        // Log error but don't fail registration
        logger.error('Failed to send verification email:', error);
      }
      
      // Set tokens as httpOnly cookies
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      });
      
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
      
      // Set auth mode cookie for frontend to detect secure mode
      res.cookie('auth_mode', 'secure', {
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      sendSuccess(res, {
        user: result.user,
        // Only include tokens in response if client doesn't support cookies (for backward compatibility)
        ...(req.headers['x-auth-mode'] !== 'secure' && {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn
        }),
        message: 'Registration successful. Please check your email to verify your account.'
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      // Verify CAPTCHA if provided or required
      if (CaptchaService.isRequired('login') || req.body.captchaToken) {
        if (!req.body.captchaToken) {
          sendError(res, 'CAPTCHA_REQUIRED', 'CAPTCHA verification is required', 400);
          return;
        }
        
        const clientIp = req.ip || req.socket.remoteAddress;
        await CaptchaService.verify(req.body.captchaToken, clientIp);
      }

      const result = await UserService.login(req.body, req);
      
      // Set tokens as httpOnly cookies
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      });
      
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
      
      // Set auth mode cookie for frontend to detect secure mode
      res.cookie('auth_mode', 'secure', {
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      sendSuccess(res, {
        user: result.user,
        // Only include tokens in response if client doesn't support cookies (for backward compatibility)
        ...(req.headers['x-auth-mode'] !== 'secure' && {
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn
        })
      });
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request<{}, {}, RefreshTokenInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      // Get refresh token from body or cookie
      const refreshToken = req.body.refreshToken || (req as any).cookies?.refreshToken;
      
      if (!refreshToken) {
        sendError(res, 'REFRESH_TOKEN_REQUIRED', 'Refresh token is required', 400);
        return;
      }

      // First verify the refresh token to get the user ID
      const payload = await TokenService.verifyRefreshToken(refreshToken);
      
      // Fetch the user to get their current role
      const user = await UserRepository.findById(payload.sub);
      if (!user) {
        sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
        return;
      }

      // Generate new tokens with the user's current role
      const tokens = await TokenService.refreshTokens(refreshToken, user.role as UserRole);
      
      // Set new tokens as httpOnly cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      });
      
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      sendSuccess(res, {
        // Only include token in response if client doesn't support cookies (for backward compatibility)
        ...(req.headers['x-auth-mode'] !== 'secure' && {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn
        })
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await TokenService.revokeSession(req.user.sessionId);
        await CSRFService.deleteToken(req.user.sessionId);
        logger.info(`User ${req.user.email} logged out`);
      }
      
      // Clear all auth cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      res.clearCookie('auth_mode');
      res.clearCookie('csrf_token');
      
      sendSuccess(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        return;
      }

      const profile = await UserService.getProfile(req.user.id);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request<{}, {}, ForgotPasswordInput>, res: Response, _next: NextFunction): Promise<void> {
    try {
      // Verify CAPTCHA if provided or required
      if (CaptchaService.isRequired('forgot-password') || req.body.captchaToken) {
        if (!req.body.captchaToken) {
          sendError(res, 'CAPTCHA_REQUIRED', 'CAPTCHA verification is required', 400);
          return;
        }
        
        const clientIp = req.ip || req.socket.remoteAddress;
        await CaptchaService.verify(req.body.captchaToken, clientIp);
      }

      await PasswordResetService.requestPasswordReset(req.body.email);
      
      // Always return success to prevent email enumeration
      sendSuccess(res, {
        message: 'If an account exists with that email address, a password reset link has been sent.'
      });
    } catch (error) {
      // Log the error but don't expose details to user
      logger.error('Password reset request error', error);
      
      // Still return success to prevent email enumeration
      sendSuccess(res, {
        message: 'If an account exists with that email address, a password reset link has been sent.'
      });
    }
  }

  static async resetPassword(req: Request<{}, {}, ResetPasswordInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      
      await PasswordResetService.resetPassword(token, password);
      
      sendSuccess(res, {
        message: 'Password has been reset successfully. You can now login with your new password.'
      });
    } catch (error) {
      next(error);
    }
  }

  static async validateResetToken(req: Request<{ token: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      
      const result = await PasswordResetService.validateToken(token);
      
      sendSuccess(res, {
        valid: true,
        email: result.email
      });
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmail(req: Request<{}, {}, { token: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      
      const result = await EmailVerificationService.verifyEmail(token);
      
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async resendVerificationEmail(req: Request<{}, {}, { email: string }>, res: Response, _next: NextFunction): Promise<void> {
    try {
      await EmailVerificationService.resendVerificationEmail(req.body.email);
      
      // Always return success to prevent email enumeration
      sendSuccess(res, {
        message: 'If an account exists with that email address, a verification email has been sent.'
      });
    } catch (error) {
      // Log the error but don't expose details to user
      logger.error('Resend verification email error', error);
      
      // Still return success to prevent email enumeration
      sendSuccess(res, {
        message: 'If an account exists with that email address, a verification email has been sent.'
      });
    }
  }

  static async checkVerificationStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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

      sendSuccess(res, {
        email_verified: user.email_verified,
        email: user.email
      });
    } catch (error) {
      next(error);
    }
  }

  // Google OAuth methods
  static async googleAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const state = req.query['state'] as string || '';
      const authUrl = GoogleOAuthService.generateAuthUrl(state);
      
      res.redirect(authUrl);
    } catch (error) {
      next(error);
    }
  }

  static async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;
      
      if (!code || typeof code !== 'string') {
        sendError(res, 'INVALID_REQUEST', 'Authorization code is required', 400);
        return;
      }

      const result = await GoogleOAuthService.handleCallback(code);
      
      // Set tokens as httpOnly cookies
      res.cookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      });
      
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
      
      // Set auth mode cookie for frontend to detect secure mode
      res.cookie('auth_mode', 'secure', {
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      // Redirect to frontend (tokens now in cookies, not URL)
      const redirectUrl = new URL(`${env.FRONTEND_URL}/auth/google/callback`);
      if (state) {
        redirectUrl.searchParams.set('state', state as string);
      }
      
      res.redirect(redirectUrl.toString());
    } catch (error) {
      // Redirect to frontend with error
      const errorUrl = new URL(`${env.FRONTEND_URL}/auth/google/callback`);
      errorUrl.searchParams.set('error', 'authentication_failed');
      errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'Failed to authenticate with Google');
      
      res.redirect(errorUrl.toString());
    }
  }

  static async linkGoogleAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        return;
      }

      const { code } = req.body;
      
      if (!code || typeof code !== 'string') {
        sendError(res, 'INVALID_REQUEST', 'Authorization code is required', 400);
        return;
      }

      await GoogleOAuthService.linkGoogleAccount(req.user.id, code);
      
      sendSuccess(res, {
        message: 'Google account linked successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async unlinkGoogleAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        return;
      }

      await GoogleOAuthService.unlinkGoogleAccount(req.user.id);
      
      sendSuccess(res, {
        message: 'Google account unlinked successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLinkedProviders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        return;
      }

      const providers = await GoogleOAuthService.getLinkedProviders(req.user.id);
      
      sendSuccess(res, {
        providers
      });
    } catch (error) {
      next(error);
    }
  }

  static async checkCaptchaRequired(req: Request<{ action: string }>, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action } = req.params;
      
      const required = CaptchaService.isRequired(action);
      
      sendSuccess(res, {
        required,
        action
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'UNAUTHORIZED', 'User not authenticated', 401);
        return;
      }

      const { oldPassword, newPassword } = req.body;

      await UserService.changePassword(req.user.id, oldPassword, newPassword);

      // Invalidate all existing sessions for security
      try {
        await TokenService.revokeAllUserSessions(req.user.id);
      } catch (error) {
        // Log but don't fail if session invalidation fails
        logger.warn('Failed to invalidate sessions after password change', { userId: req.user.id, error });
      }

      sendSuccess(res, {
        message: 'Password changed successfully. Please login with your new password.'
      });
    } catch (error) {
      next(error);
    }
  }
}