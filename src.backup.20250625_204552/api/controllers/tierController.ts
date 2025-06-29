import { Request, Response, NextFunction } from 'express';
import tierService from '../../services/tierService';
import pricingService from '../../services/pricingService';
import { sendSuccess } from '../../utils/responseFormatter';

interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: string;
  };
}

export class TierController {
  /**
   * Get all available tiers
   */
  static async getAllTiers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tiers = await tierService.getAllTiers();
      sendSuccess(res, tiers);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's tier information
   */
  static async getUserTier(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const tierInfo = await tierService.getUserTierInfo(userId);
      
      if (!tierInfo) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TIER_NOT_FOUND',
            message: 'User tier information not found'
          }
        });
        return;
      }

      sendSuccess(res, tierInfo);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's tier history
   */
  static async getUserTierHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const limit = parseInt(req.query['limit'] as string) || 10;
      
      const history = await tierService.getUserTierHistory(userId, limit);
      sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's fee summary
   */
  static async getUserFees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const feeSummary = await pricingService.getUserFeeSummary(userId);
      sendSuccess(res, feeSummary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate fees for a specific action
   */
  static async calculateFees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { action, amount } = req.body;

      let result;
      
      switch (action) {
        case 'card_creation':
          result = await pricingService.calculateCardCreationFee(userId);
          break;
          
        case 'deposit':
          if (!amount) {
            res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_AMOUNT',
                message: 'Amount is required for deposit fee calculation'
              }
            });
            return;
          }
          result = await pricingService.calculateDepositFee(userId, amount);
          break;
          
        case 'withdrawal':
          if (!amount) {
            res.status(400).json({
              success: false,
              error: {
                code: 'MISSING_AMOUNT',
                message: 'Amount is required for withdrawal fee calculation'
              }
            });
            return;
          }
          result = await pricingService.calculateWithdrawalFee(userId, amount);
          break;
          
        default:
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: 'Invalid action. Supported actions: card_creation, deposit, withdrawal'
            }
          });
          return;
      }

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process pending monthly fees
   */
  static async processMonthlyFees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const result = await pricingService.processPendingMonthlyFees(userId);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}