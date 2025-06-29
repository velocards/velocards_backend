"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionController = void 0;
const transactionService_1 = require("../../services/transactionService");
const responseFormatter_1 = require("../../utils/responseFormatter");
const logger_1 = __importDefault(require("../../utils/logger"));
class TransactionController {
    /**
     * Get user's transaction history
     * GET /api/v1/transactions
     */
    static async getTransactionHistory(req, res, next) {
        try {
            const userId = req.user.sub;
            const { page = 1, limit = 20, ...filterParams } = req.query;
            // Build filters
            const filters = {};
            if (filterParams['card_id'])
                filters.card_id = filterParams['card_id'];
            if (filterParams['type'])
                filters.type = filterParams['type'];
            if (filterParams['status'])
                filters.status = filterParams['status'];
            if (filterParams['from_date'])
                filters.from_date = new Date(filterParams['from_date']);
            if (filterParams['to_date'])
                filters.to_date = new Date(filterParams['to_date']);
            if (filterParams['min_amount'])
                filters.min_amount = Number(filterParams['min_amount']);
            if (filterParams['max_amount'])
                filters.max_amount = Number(filterParams['max_amount']);
            if (filterParams['merchant_name'])
                filters.merchant_name = filterParams['merchant_name'];
            // Build pagination
            const pagination = {
                page: Number(page),
                limit: Number(limit)
            };
            const result = await transactionService_1.TransactionService.getTransactionHistory(userId, filters, pagination);
            logger_1.default.info('Transaction history retrieved', {
                userId,
                filters,
                pagination,
                totalTransactions: result.pagination.total
            });
            (0, responseFormatter_1.sendSuccess)(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get specific transaction details
     * GET /api/v1/transactions/:transactionId
     */
    static async getTransactionDetails(req, res, next) {
        try {
            const userId = req.user.sub;
            const { transactionId } = req.params;
            const transaction = await transactionService_1.TransactionService.getTransactionDetails(userId, transactionId);
            (0, responseFormatter_1.sendSuccess)(res, transaction);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get transactions for a specific card
     * GET /api/v1/transactions/cards/:cardId
     */
    static async getCardTransactions(req, res, next) {
        try {
            const userId = req.user.sub;
            const { cardId } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const pagination = {
                page: Number(page),
                limit: Number(limit)
            };
            const result = await transactionService_1.TransactionService.getCardTransactions(userId, cardId, pagination);
            logger_1.default.info('Card transactions retrieved', {
                userId,
                cardId,
                totalTransactions: result.pagination.total
            });
            (0, responseFormatter_1.sendSuccess)(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Dispute a transaction
     * POST /api/v1/transactions/:transactionId/dispute
     */
    static async disputeTransaction(req, res, next) {
        try {
            const userId = req.user.sub;
            const { transactionId } = req.params;
            const { reason } = req.body;
            const transaction = await transactionService_1.TransactionService.disputeTransaction(userId, transactionId, { reason });
            logger_1.default.info('Transaction disputed', {
                userId,
                transactionId,
                reason
            });
            (0, responseFormatter_1.sendSuccess)(res, transaction, 200);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Export transactions
     * GET /api/v1/transactions/export
     */
    static async exportTransactions(req, res, next) {
        try {
            const userId = req.user.sub;
            const { format = 'csv', ...filterParams } = req.query;
            // Build filters
            const filters = {};
            if (filterParams['card_id'])
                filters.card_id = filterParams['card_id'];
            if (filterParams['type'])
                filters.type = filterParams['type'];
            if (filterParams['status'])
                filters.status = filterParams['status'];
            if (filterParams['from_date'])
                filters.from_date = new Date(filterParams['from_date']);
            if (filterParams['to_date'])
                filters.to_date = new Date(filterParams['to_date']);
            if (filterParams['min_amount'])
                filters.min_amount = Number(filterParams['min_amount']);
            if (filterParams['max_amount'])
                filters.max_amount = Number(filterParams['max_amount']);
            if (filterParams['merchant_name'])
                filters.merchant_name = filterParams['merchant_name'];
            const result = await transactionService_1.TransactionService.exportTransactions(userId, {
                format: format,
                filters
            });
            logger_1.default.info('Transactions exported', {
                userId,
                format,
                filename: result.filename
            });
            // Set appropriate headers for download
            res.setHeader('Content-Type', result.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            // Send the file data
            res.send(result.data);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get transaction statistics
     * GET /api/v1/transactions/stats
     */
    static async getTransactionStats(req, res, next) {
        try {
            const userId = req.user.sub;
            const { from_date, to_date } = req.query;
            let period;
            if (from_date && to_date) {
                period = {
                    from: new Date(from_date),
                    to: new Date(to_date)
                };
            }
            const stats = await transactionService_1.TransactionService.getTransactionStats(userId, period);
            (0, responseFormatter_1.sendSuccess)(res, stats);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Create mock transaction (for testing)
     * POST /api/v1/transactions/mock
     */
    static async createMockTransaction(req, res, next) {
        try {
            const userId = req.user.sub;
            const { cardId } = req.body;
            const transaction = await transactionService_1.TransactionService.createMockTransaction(userId, cardId);
            logger_1.default.info('Mock transaction created', {
                userId,
                transactionId: transaction.id,
                amount: transaction.amount
            });
            (0, responseFormatter_1.sendSuccess)(res, transaction, 201);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.TransactionController = TransactionController;
//# sourceMappingURL=transactionController.js.map