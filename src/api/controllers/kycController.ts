import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import KYCService from '../../services/kycService';
import { sendSuccess, sendError } from '../../utils/responseFormatter';
import logger from '../../utils/logger';

export class KYCController {
  /**
   * Initiate KYC verification for the authenticated user
   */
  static async initiateKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      logger.info('Initiating KYC verification', { userId });

      const result = await KYCService.initiateKYC(userId);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get KYC status for the authenticated user
   */
  static async getKYCStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      logger.info('Getting KYC status', { userId });

      const status = await KYCService.getKYCStatus(userId);

      sendSuccess(res, status);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset KYC verification for retry
   */
  static async resetKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      logger.info('Resetting KYC verification', { userId });

      await KYCService.resetKYC(userId);

      sendSuccess(res, { success: true, message: 'KYC verification reset successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process webhook from Sumsub
   */
  static async processWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-sumsub-signature'] as string;
      
      if (!signature) {
        logger.warn('Webhook received without signature');
        sendError(res, 'MISSING_SIGNATURE', 'Webhook signature missing', 401);
        return;
      }

      logger.info('Processing Sumsub webhook', {
        type: req.body.type,
        applicantId: req.body.applicantId,
        externalUserId: req.body.externalUserId,
      });

      await KYCService.processWebhook(req.body, signature);

      // Acknowledge webhook receipt
      res.status(200).json({ success: true });
    } catch (error: any) {
      if (error.code === 'INVALID_WEBHOOK_SIGNATURE') {
        logger.error('Invalid webhook signature');
        sendError(res, 'INVALID_SIGNATURE', 'Invalid webhook signature', 401);
        return;
      }
      next(error);
    }
  }
}