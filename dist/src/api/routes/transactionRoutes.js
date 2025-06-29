"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const transactionController_1 = require("../controllers/transactionController");
const auth_1 = require("../middlewares/auth");
const authorize_1 = require("../middlewares/authorize");
const validate_1 = require("../middlewares/validate");
const transactionValidators_1 = require("../validators/transactionValidators");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /api/v1/transactions
 * @desc    Get user's transaction history with filters
 * @access  Private - Requires 'transactions:read' permission
 */
router.get('/', (0, authorize_1.authorize)('transactions:read'), (0, validate_1.validate)(transactionValidators_1.getTransactionHistorySchema), transactionController_1.TransactionController.getTransactionHistory);
/**
 * @route   GET /api/v1/transactions/export
 * @desc    Export transactions in CSV or JSON format
 * @access  Private - Requires 'transactions:export' permission
 * Note: This route must come before /:transactionId to avoid conflicts
 */
router.get('/export', (0, authorize_1.authorize)('transactions:export'), (0, validate_1.validate)(transactionValidators_1.exportTransactionsSchema), transactionController_1.TransactionController.exportTransactions);
/**
 * @route   GET /api/v1/transactions/stats
 * @desc    Get transaction statistics
 * @access  Private - Requires 'transactions:read' permission
 * Note: This route must come before /:transactionId to avoid conflicts
 */
router.get('/stats', (0, authorize_1.authorize)('transactions:read'), transactionController_1.TransactionController.getTransactionStats);
/**
 * @route   GET /api/v1/transactions/cards/:cardId
 * @desc    Get transactions for a specific card
 * @access  Private - Requires 'transactions:read' permission
 * Note: This route must come before /:transactionId to avoid conflicts
 */
router.get('/cards/:cardId', (0, authorize_1.authorize)('transactions:read'), (0, validate_1.validate)(transactionValidators_1.getCardTransactionsSchema), transactionController_1.TransactionController.getCardTransactions);
/**
 * @route   POST /api/v1/transactions/mock
 * @desc    Create a mock transaction for testing
 * @access  Private - Requires 'transactions:create' permission
 * Note: This endpoint is for testing only and should be disabled in production
 */
if (process.env['NODE_ENV'] !== 'production') {
    router.post('/mock', (0, authorize_1.authorize)('transactions:create'), (0, validate_1.validate)(transactionValidators_1.createMockTransactionSchema), transactionController_1.TransactionController.createMockTransaction);
}
/**
 * @route   GET /api/v1/transactions/:transactionId
 * @desc    Get specific transaction details
 * @access  Private - Requires 'transactions:read' permission
 */
router.get('/:transactionId', (0, authorize_1.authorize)('transactions:read'), (0, validate_1.validate)(transactionValidators_1.getTransactionDetailsSchema), transactionController_1.TransactionController.getTransactionDetails);
/**
 * @route   POST /api/v1/transactions/:transactionId/dispute
 * @desc    Dispute a transaction
 * @access  Private - Requires 'transactions:dispute' permission
 */
router.post('/:transactionId/dispute', (0, authorize_1.authorize)('transactions:dispute'), (0, validate_1.validate)(transactionValidators_1.disputeTransactionSchema), transactionController_1.TransactionController.disputeTransaction);
exports.default = router;
//# sourceMappingURL=transactionRoutes.js.map