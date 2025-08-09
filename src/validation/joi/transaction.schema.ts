import Joi from 'joi';

// Transaction type enum
const TransactionTypes = [
  'authorization',
  'capture',
  'refund',
  'reversal',
  'deposit',
  'withdrawal',
  'fee'
];

// Transaction status enum
const TransactionStatuses = [
  'pending',
  'completed',
  'failed',
  'reversed',
  'disputed'
];

// Get transaction history query params
export const getTransactionHistorySchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().positive().optional().default(1),
    limit: Joi.number().integer().positive().max(100).optional().default(20),
    card_id: Joi.string().uuid().optional(),
    type: Joi.string().valid(...TransactionTypes).optional(),
    status: Joi.string().valid(...TransactionStatuses).optional(),
    from_date: Joi.date().iso().optional(),
    to_date: Joi.date().iso().optional(),
    min_amount: Joi.number().positive().optional(),
    max_amount: Joi.number().positive().optional(),
    merchant_name: Joi.string().min(1).max(255).optional()
  })
});

// Get transaction details params
export const getTransactionDetailsSchema = Joi.object({
  params: Joi.object({
    transactionId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid transaction ID format'
    })
  })
});

// Get card transactions params
export const getCardTransactionsSchema = Joi.object({
  params: Joi.object({
    cardId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid card ID format'
    })
  }),
  query: Joi.object({
    page: Joi.number().integer().positive().optional().default(1),
    limit: Joi.number().integer().positive().max(100).optional().default(20)
  })
});

// Dispute transaction body
export const disputeTransactionSchema = Joi.object({
  params: Joi.object({
    transactionId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid transaction ID format'
    })
  }),
  body: Joi.object({
    reason: Joi.string()
      .min(10)
      .max(1000)
      .trim()
      .required()
      .messages({
        'string.min': 'Dispute reason must be at least 10 characters',
        'string.max': 'Dispute reason must not exceed 1000 characters'
      })
  })
});

// Export transactions query params
export const exportTransactionsSchema = Joi.object({
  query: Joi.object({
    format: Joi.string().valid('csv', 'json').optional().default('csv'),
    card_id: Joi.string().uuid().optional(),
    type: Joi.string().valid(...TransactionTypes).optional(),
    status: Joi.string().valid(...TransactionStatuses).optional(),
    from_date: Joi.date().iso().optional(),
    to_date: Joi.date().iso().optional(),
    min_amount: Joi.number().positive().optional(),
    max_amount: Joi.number().positive().optional(),
    merchant_name: Joi.string().min(1).max(255).optional()
  })
});

// Create mock transaction body (for testing)
export const createMockTransactionSchema = Joi.object({
  body: Joi.object({
    cardId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid card ID format'
    }),
    amount: Joi.number()
      .positive()
      .max(5000)
      .optional()
      .messages({
        'number.positive': 'Amount must be positive',
        'number.max': 'Mock transaction amount cannot exceed $5000'
      }),
    merchantName: Joi.string()
      .min(1)
      .max(255)
      .optional(),
    merchantCategory: Joi.string()
      .min(1)
      .max(50)
      .optional()
  })
});

// Refine pagination values function (compatible with both validators)
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