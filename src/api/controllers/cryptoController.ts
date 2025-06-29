import { Request, Response, NextFunction } from 'express';
import { CryptoService } from '../../services/cryptoService';
import { sendSuccess } from '../../utils/responseFormatter';
import logger from '../../utils/logger';
import { AppError } from '../../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role: string;
    permissions: string[];
  };
  id?: string;
}

export class CryptoController {
  /**
   * Create a deposit order
   * POST /api/v1/crypto/deposit/order
   */
  static async createDepositOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { amount, currency } = req.body;

      logger.info('Creating deposit order', { userId, amount, currency });

      const order = await CryptoService.createDepositOrder(userId, { amount, currency });

      sendSuccess(res, {
        order: {
          id: order.id,
          order_reference: order.order_reference,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          redirect_url: order.redirect_url,
          created_at: order.created_at
        }
      }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deposit history
   * GET /api/v1/crypto/deposit/history
   */
  static async getDepositHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { page, limit, status, startDate, endDate } = req.query as any;

      logger.info('Fetching deposit history', { userId, filters: req.query });

      const result = await CryptoService.getDepositHistory(userId, {
        page,
        limit,
        status,
        startDate,
        endDate
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // /**
  //  * Create withdrawal - DISABLED (not supported)
  //  * POST /api/v1/crypto/withdraw
  //  */
  // static async createWithdrawal(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  //   try {
  //     const userId = req.user!.sub;
  //     const { amount, currency, address, network } = req.body;

  //     logger.info('Creating withdrawal', { userId, amount, currency, address });

  //     const transaction = await CryptoService.createWithdrawal(userId, {
  //       amount,
  //       currency,
  //       address,
  //       network
  //     });

  //     sendSuccess(res, {
  //       withdrawal: {
  //         id: transaction.id,
  //         amount: transaction.crypto_amount,
  //         currency: transaction.crypto_currency,
  //         address: transaction.wallet_address,
  //         status: transaction.status,
  //         fee: transaction.fee_amount,
  //         created_at: transaction.created_at
  //       }
  //     }, 201);
  //   } catch (error) {
  //     next(error);
  //   }
  // }

  // /**
  //  * Get exchange rates - DISABLED (not needed without withdrawals)
  //  * GET /api/v1/crypto/rates
  //  */
  // static async getExchangeRates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  //   try {
  //     const { from, to } = req.query as any;

  //     logger.info('Fetching exchange rates', { from, to });

  //     const rates = await CryptoService.getExchangeRates(from, to);

  //     sendSuccess(res, Array.isArray(rates) ? { rates } : { rate: rates });
  //   } catch (error) {
  //     next(error);
  //   }
  // }

  // /**
  //  * Get specific exchange rate - DISABLED (not needed without withdrawals)
  //  * GET /api/v1/crypto/rates/:from/:to
  //  */
  // static async getSpecificExchangeRate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  //   try {
  //     const { from, to } = req.params;

  //     if (!from || !to) {
  //       throw new AppError('VALIDATION_ERROR', 'Both from and to currencies are required', 400);
  //     }

  //     logger.info('Fetching specific exchange rate', { from, to });

  //     const rate = await CryptoService.getExchangeRates(from.toUpperCase(), to.toUpperCase());

  //     if (Array.isArray(rate)) {
  //       throw new AppError('VALIDATION_ERROR', 'Invalid currency pair', 400);
  //     }

  //     sendSuccess(res, { rate });
  //   } catch (error) {
  //     next(error);
  //   }
  // }

  /**
   * Get order status
   * GET /api/v1/crypto/orders/:orderId
   */
  static async getOrderStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { orderId } = req.params;

      if (!orderId) {
        throw new AppError('VALIDATION_ERROR', 'Order ID is required', 400);
      }

      logger.info('Fetching order status', { userId, orderId });

      const order = await CryptoService.getOrderStatus(userId, orderId);

      sendSuccess(res, { order });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process xMoney webhook
   * POST /api/v1/webhooks/xmoney
   * Note: This endpoint should not require authentication
   */
  static async processWebhook(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const { signature } = req.body;
      const payload = req.body;

      logger.info('Processing xMoney webhook', { 
        event_type: payload.event_type,
        reference: payload.resource?.reference 
      });

      // Verify and process webhook
      await CryptoService.processWebhook(payload, signature);

      // xMoney expects a 200 OK response
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Webhook processing failed', { error, payload: req.body });
      
      // For webhooks, we typically want to return 200 even on error
      // to prevent retries if the error is on our side
      if ((error as AppError).code === 'INVALID_SIGNATURE') {
        res.status(400).json({ success: false, error: 'Invalid signature' });
      } else {
        res.status(200).json({ success: true });
      }
    }
  }
}