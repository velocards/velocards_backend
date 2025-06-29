import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/userService';
import { TokenService } from '../../services/tokenService';
import { UserRepository } from '../../repositories/userRepository';
import { sendSuccess, sendError } from '../../utils/responseFormatter';
import { RegisterInput, LoginInput, RefreshTokenInput } from '../validators/authValidators';
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

      const result = await UserService.register(req.body);
      
      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      sendSuccess(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await UserService.login(req.body);
      
      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      sendSuccess(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn
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
      
      // Set new refresh token as httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      sendSuccess(res, {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await TokenService.revokeSession(req.user.sessionId);
        logger.info(`User ${req.user.email} logged out`);
      }
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken');
      
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
}