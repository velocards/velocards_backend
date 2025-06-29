import express from 'express';
import { TransactionController } from '../controllers/transactionController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import {
  getTransactionHistorySchema,
  getTransactionDetailsSchema,
  getCardTransactionsSchema,
  disputeTransactionSchema,
  exportTransactionsSchema,
  createMockTransactionSchema
} from '../validators/transactionValidators';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/transactions
 * @desc    Get user's transaction history with filters
 * @access  Private - Requires 'transactions:read' permission
 */
router.get(
  '/',
  authorize('transactions:read'),
  validate(getTransactionHistorySchema),
  TransactionController.getTransactionHistory
);

/**
 * @route   GET /api/v1/transactions/export
 * @desc    Export transactions in CSV or JSON format
 * @access  Private - Requires 'transactions:export' permission
 * Note: This route must come before /:transactionId to avoid conflicts
 */
router.get(
  '/export',
  authorize('transactions:export'),
  validate(exportTransactionsSchema),
  TransactionController.exportTransactions
);

/**
 * @route   GET /api/v1/transactions/stats
 * @desc    Get transaction statistics
 * @access  Private - Requires 'transactions:read' permission
 * Note: This route must come before /:transactionId to avoid conflicts
 */
router.get(
  '/stats',
  authorize('transactions:read'),
  TransactionController.getTransactionStats
);

/**
 * @route   GET /api/v1/transactions/cards/:cardId
 * @desc    Get transactions for a specific card
 * @access  Private - Requires 'transactions:read' permission
 * Note: This route must come before /:transactionId to avoid conflicts
 */
router.get(
  '/cards/:cardId',
  authorize('transactions:read'),
  validate(getCardTransactionsSchema),
  TransactionController.getCardTransactions
);

/**
 * @route   POST /api/v1/transactions/mock
 * @desc    Create a mock transaction for testing
 * @access  Private - Requires 'transactions:create' permission
 * Note: This endpoint is for testing only and should be disabled in production
 */
if (process.env['NODE_ENV'] !== 'production') {
  router.post(
    '/mock',
    authorize('transactions:create'),
    validate(createMockTransactionSchema),
    TransactionController.createMockTransaction
  );
}

/**
 * @route   GET /api/v1/transactions/:transactionId
 * @desc    Get specific transaction details
 * @access  Private - Requires 'transactions:read' permission
 */
router.get(
  '/:transactionId',
  authorize('transactions:read'),
  validate(getTransactionDetailsSchema),
  TransactionController.getTransactionDetails
);

/**
 * @route   POST /api/v1/transactions/:transactionId/dispute
 * @desc    Dispute a transaction
 * @access  Private - Requires 'transactions:dispute' permission
 */
router.post(
  '/:transactionId/dispute',
  authorize('transactions:dispute'),
  validate(disputeTransactionSchema),
  TransactionController.disputeTransaction
);

export default router;