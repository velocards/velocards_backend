"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refinePagination = exports.createMockTransactionSchema = exports.exportTransactionsSchema = exports.disputeTransactionSchema = exports.getCardTransactionsSchema = exports.getTransactionDetailsSchema = exports.getTransactionHistorySchema = void 0;
const zod_1 = require("zod");
// Transaction type enum
const TransactionTypeEnum = zod_1.z.enum([
    'authorization',
    'capture',
    'refund',
    'reversal',
    'deposit',
    'withdrawal',
    'fee'
]);
// Transaction status enum
const TransactionStatusEnum = zod_1.z.enum([
    'pending',
    'completed',
    'failed',
    'reversed',
    'disputed'
]);
// Get transaction history query params
exports.getTransactionHistorySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        card_id: zod_1.z.string().uuid().optional(),
        type: TransactionTypeEnum.optional(),
        status: TransactionStatusEnum.optional(),
        from_date: zod_1.z.string().datetime().optional(),
        to_date: zod_1.z.string().datetime().optional(),
        min_amount: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
        max_amount: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
        merchant_name: zod_1.z.string().min(1).max(255).optional()
    })
});
// Get transaction details params
exports.getTransactionDetailsSchema = zod_1.z.object({
    params: zod_1.z.object({
        transactionId: zod_1.z.string().uuid({
            message: 'Invalid transaction ID format'
        })
    })
});
// Get card transactions params
exports.getCardTransactionsSchema = zod_1.z.object({
    params: zod_1.z.object({
        cardId: zod_1.z.string().uuid({
            message: 'Invalid card ID format'
        })
    }),
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20')
    })
});
// Dispute transaction body
exports.disputeTransactionSchema = zod_1.z.object({
    params: zod_1.z.object({
        transactionId: zod_1.z.string().uuid({
            message: 'Invalid transaction ID format'
        })
    }),
    body: zod_1.z.object({
        reason: zod_1.z.string()
            .min(10, 'Dispute reason must be at least 10 characters')
            .max(1000, 'Dispute reason must not exceed 1000 characters')
            .trim()
    })
});
// Export transactions query params
exports.exportTransactionsSchema = zod_1.z.object({
    query: zod_1.z.object({
        format: zod_1.z.enum(['csv', 'json']).default('csv'),
        card_id: zod_1.z.string().uuid().optional(),
        type: TransactionTypeEnum.optional(),
        status: TransactionStatusEnum.optional(),
        from_date: zod_1.z.string().datetime().optional(),
        to_date: zod_1.z.string().datetime().optional(),
        min_amount: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
        max_amount: zod_1.z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
        merchant_name: zod_1.z.string().min(1).max(255).optional()
    })
});
// Create mock transaction body (for testing)
exports.createMockTransactionSchema = zod_1.z.object({
    body: zod_1.z.object({
        cardId: zod_1.z.string().uuid({
            message: 'Invalid card ID format'
        }),
        amount: zod_1.z.number()
            .positive('Amount must be positive')
            .max(5000, 'Mock transaction amount cannot exceed $5000')
            .optional(),
        merchantName: zod_1.z.string()
            .min(1)
            .max(255)
            .optional(),
        merchantCategory: zod_1.z.string()
            .min(1)
            .max(50)
            .optional()
    })
});
// Refine pagination values
const refinePagination = (data) => {
    const page = Math.max(1, data.query?.page || 1);
    const limit = Math.min(100, Math.max(1, data.query?.limit || 20));
    return {
        ...data,
        query: {
            ...data.query,
            page,
            limit
        }
    };
};
exports.refinePagination = refinePagination;
//# sourceMappingURL=transactionValidators.js.map