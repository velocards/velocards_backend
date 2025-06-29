import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { 
  TransactionService, 
  TransactionFilters, 
  PaginationOptions 
} from '../../services/transactionService';
import { sendSuccess } from '../../utils/responseFormatter';
import logger from '../../utils/logger';

export class TransactionController {
  /**
   * Get user's transaction history
   * GET /api/v1/transactions
   */
  static async getTransactionHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { page = 1, limit = 20, ...filterParams } = req.query;

      // Build filters
      const filters: TransactionFilters = {};
      
      if (filterParams['card_id']) filters.card_id = filterParams['card_id'] as string;
      if (filterParams['type']) filters.type = filterParams['type'] as string;
      if (filterParams['status']) filters.status = filterParams['status'] as string;
      if (filterParams['from_date']) filters.from_date = new Date(filterParams['from_date'] as string);
      if (filterParams['to_date']) filters.to_date = new Date(filterParams['to_date'] as string);
      if (filterParams['min_amount']) filters.min_amount = Number(filterParams['min_amount']);
      if (filterParams['max_amount']) filters.max_amount = Number(filterParams['max_amount']);
      if (filterParams['merchant_name']) filters.merchant_name = filterParams['merchant_name'] as string;

      // Build pagination
      const pagination: PaginationOptions = {
        page: Number(page),
        limit: Number(limit)
      };

      const result = await TransactionService.getTransactionHistory(
        userId,
        filters,
        pagination
      );

      logger.info('Transaction history retrieved', {
        userId,
        filters,
        pagination,
        totalTransactions: result.pagination.total
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific transaction details
   * GET /api/v1/transactions/:transactionId
   */
  static async getTransactionDetails(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { transactionId } = req.params;

      const transaction = await TransactionService.getTransactionDetails(
        userId,
        transactionId!
      );

      sendSuccess(res, transaction);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transactions for a specific card
   * GET /api/v1/transactions/cards/:cardId
   */
  static async getCardTransactions(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { cardId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pagination: PaginationOptions = {
        page: Number(page),
        limit: Number(limit)
      };

      const result = await TransactionService.getCardTransactions(
        userId,
        cardId!,
        pagination
      );

      logger.info('Card transactions retrieved', {
        userId,
        cardId,
        totalTransactions: result.pagination.total
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dispute a transaction
   * POST /api/v1/transactions/:transactionId/dispute
   */
  static async disputeTransaction(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { transactionId } = req.params;
      const { reason } = req.body;

      const transaction = await TransactionService.disputeTransaction(
        userId,
        transactionId!,
        { reason }
      );

      logger.info('Transaction disputed', {
        userId,
        transactionId,
        reason
      });

      sendSuccess(res, transaction, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export transactions
   * GET /api/v1/transactions/export
   */
  static async exportTransactions(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { format = 'csv', ...filterParams } = req.query;

      // Build filters
      const filters: TransactionFilters = {};
      
      if (filterParams['card_id']) filters.card_id = filterParams['card_id'] as string;
      if (filterParams['type']) filters.type = filterParams['type'] as string;
      if (filterParams['status']) filters.status = filterParams['status'] as string;
      if (filterParams['from_date']) filters.from_date = new Date(filterParams['from_date'] as string);
      if (filterParams['to_date']) filters.to_date = new Date(filterParams['to_date'] as string);
      if (filterParams['min_amount']) filters.min_amount = Number(filterParams['min_amount']);
      if (filterParams['max_amount']) filters.max_amount = Number(filterParams['max_amount']);
      if (filterParams['merchant_name']) filters.merchant_name = filterParams['merchant_name'] as string;

      const result = await TransactionService.exportTransactions(
        userId,
        {
          format: format as 'csv' | 'json',
          filters
        }
      );

      logger.info('Transactions exported', {
        userId,
        format,
        filename: result.filename
      });

      // Set appropriate headers for download
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      
      // Send the file data
      res.send(result.data);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transaction statistics
   * GET /api/v1/transactions/stats
   */
  static async getTransactionStats(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { from_date, to_date } = req.query;

      let period;
      if (from_date && to_date) {
        period = {
          from: new Date(from_date as string),
          to: new Date(to_date as string)
        };
      }

      const stats = await TransactionService.getTransactionStats(userId, period);

      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create mock transaction (for testing)
   * POST /api/v1/transactions/mock
   */
  static async createMockTransaction(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.sub;
      const { cardId } = req.body;

      const transaction = await TransactionService.createMockTransaction(
        userId,
        cardId
      );

      logger.info('Mock transaction created', {
        userId,
        transactionId: transaction.id,
        amount: transaction.amount
      });

      sendSuccess(res, transaction, 201);
    } catch (error) {
      next(error);
    }
  }
}