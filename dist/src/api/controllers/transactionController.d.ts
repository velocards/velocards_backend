import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare class TransactionController {
    /**
     * Get user's transaction history
     * GET /api/v1/transactions
     */
    static getTransactionHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get specific transaction details
     * GET /api/v1/transactions/:transactionId
     */
    static getTransactionDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get transactions for a specific card
     * GET /api/v1/transactions/cards/:cardId
     */
    static getCardTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Dispute a transaction
     * POST /api/v1/transactions/:transactionId/dispute
     */
    static disputeTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Export transactions
     * GET /api/v1/transactions/export
     */
    static exportTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get transaction statistics
     * GET /api/v1/transactions/stats
     */
    static getTransactionStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Create mock transaction (for testing)
     * POST /api/v1/transactions/mock
     */
    static createMockTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=transactionController.d.ts.map