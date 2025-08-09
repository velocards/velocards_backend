import { z } from 'zod';

// Transaction type enum
const TransactionTypeEnum = z.enum([
  'authorization',
  'capture',
  'refund',
  'reversal',
  'deposit',
  'withdrawal',
  'fee'
]);

// Transaction status enum
const TransactionStatusEnum = z.enum([
  'pending',
  'completed',
  'failed',
  'reversed',
  'disputed'
]);

// Get transaction history query params
export const getTransactionHistorySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    card_id: z.string().uuid().optional(),
    type: TransactionTypeEnum.optional(),
    status: TransactionStatusEnum.optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    min_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
    max_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
    merchant_name: z.string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9\s\-\.\,\&\']+$/, 'Merchant name contains invalid characters')
      .optional()
  })
});

// Get transaction details params
export const getTransactionDetailsSchema = z.object({
  params: z.object({
    transactionId: z.string().uuid({
      message: 'Invalid transaction ID format'
    })
  })
});

// Get card transactions params
export const getCardTransactionsSchema = z.object({
  params: z.object({
    cardId: z.string().uuid({
      message: 'Invalid card ID format'
    })
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20')
  })
});

// Dispute transaction body
export const disputeTransactionSchema = z.object({
  params: z.object({
    transactionId: z.string().uuid({
      message: 'Invalid transaction ID format'
    })
  }),
  body: z.object({
    reason: z.string()
      .min(10, 'Dispute reason must be at least 10 characters')
      .max(1000, 'Dispute reason must not exceed 1000 characters')
      .trim()
  })
});

// Export transactions query params
export const exportTransactionsSchema = z.object({
  query: z.object({
    format: z.enum(['csv', 'json']).default('csv'),
    card_id: z.string().uuid().optional(),
    type: TransactionTypeEnum.optional(),
    status: TransactionStatusEnum.optional(),
    from_date: z.string().datetime().optional(),
    to_date: z.string().datetime().optional(),
    min_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
    max_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
    merchant_name: z.string()
      .min(1)
      .max(255)
      .regex(/^[a-zA-Z0-9\s\-\.\,\&\']+$/, 'Merchant name contains invalid characters')
      .optional()
  })
});

// Create mock transaction body (for testing)
export const createMockTransactionSchema = z.object({
  body: z.object({
    cardId: z.string().uuid({
      message: 'Invalid card ID format'
    }),
    amount: z.number()
      .positive('Amount must be positive')
      .max(5000, 'Mock transaction amount cannot exceed $5000')
      .optional(),
    merchantName: z.string()
      .min(1)
      .max(255)
      .optional(),
    merchantCategory: z.string()
      .min(1)
      .max(50)
      .optional()
  })
});

// Refine pagination values
export const refinePagination = (data: any) => {
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

// Inferred TypeScript types
export type TransactionType = z.infer<typeof TransactionTypeEnum>;
export type TransactionStatus = z.infer<typeof TransactionStatusEnum>;
export type TransactionHistoryQuery = z.infer<typeof getTransactionHistorySchema>['query'];
export type TransactionDetailsParams = z.infer<typeof getTransactionDetailsSchema>['params'];
export type CardTransactionsParams = z.infer<typeof getCardTransactionsSchema>['params'];
export type CardTransactionsQuery = z.infer<typeof getCardTransactionsSchema>['query'];
export type DisputeTransactionInput = z.infer<typeof disputeTransactionSchema>['body'];
export type ExportTransactionsQuery = z.infer<typeof exportTransactionsSchema>['query'];
export type CreateMockTransactionInput = z.infer<typeof createMockTransactionSchema>['body'];