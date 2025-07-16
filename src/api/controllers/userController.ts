import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { UserService } from '../../services/userService';
import { sendSuccess } from '../../utils/responseFormatter';
import { NotFoundError } from '../../utils/errors';
import logger from '../../utils/logger';

export class UserController {
  /**
   * Get authenticated user's profile
   */
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const profile = await UserService.getUserProfile(userId);
      
      if (!profile) {
        throw new NotFoundError('User profile not found');
      }
      
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update authenticated user's profile
   */
  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const updateData = req.body;
      
      logger.info('Updating user profile', { 
        userId, 
        fields: Object.keys(updateData) 
      });
      
      const updatedProfile = await UserService.updateUserProfile(userId, updateData);
      
      sendSuccess(res, {
        message: 'Profile updated successfully',
        profile: updatedProfile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's current balance
   */
  static async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const balance = await UserService.getUserBalance(userId);
      
      sendSuccess(res, {
        balance: balance.virtual_balance,
        currency: 'USD',
        lastUpdated: balance.updated_at
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's available balance with breakdown
   */
  static async getAvailableBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      
      const balanceInfo = await UserService.getUserAvailableBalance(userId);
      
      sendSuccess(res, balanceInfo);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's balance history
   */
  static async getBalanceHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { 
        page = 1, 
        limit = 20, 
        from, 
        to, 
        type = 'all',
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query as any;
      
      logger.info('Fetching balance history', { 
        userId, 
        page, 
        limit, 
        type 
      });
      
      const historyParams: any = {
        page: Number(page),
        limit: Number(limit),
        type: type as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc'
      };
      
      if (from) historyParams.from = new Date(from as string);
      if (to) historyParams.to = new Date(to as string);
      
      const history = await UserService.getBalanceHistory(userId, historyParams);
      
      sendSuccess(res, {
        transactions: history.transactions,
        pagination: {
          page: history.page,
          limit: history.limit,
          total: history.total,
          totalPages: history.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user settings
   */
  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const settings = req.body;
      
      logger.info('Updating user settings', { 
        userId, 
        settingTypes: Object.keys(settings) 
      });
      
      const updatedSettings = await UserService.updateUserSettings(userId, settings);
      
      sendSuccess(res, {
        message: 'Settings updated successfully',
        settings: updatedSettings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comprehensive user statistics
   * GET /api/v1/users/statistics
   */
  static async getUserStatistics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      
      logger.info('Fetching comprehensive user statistics', { userId });
      
      const statistics = await UserService.getUserStatistics(userId);
      
      sendSuccess(res, statistics);
    } catch (error) {
      next(error);
    }
  }
}