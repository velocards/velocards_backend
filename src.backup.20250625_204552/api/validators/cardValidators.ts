import { z } from 'zod';

// Create card schema
export const createCardSchema = z.object({
  body: z.object({
    type: z.enum(['single_use', 'multi_use']),
    fundingAmount: z.number()
      .positive('Funding amount must be positive')
      .max(10000, 'Maximum funding amount is $10,000'),
    spendingLimit: z.number()
      .positive('Spending limit must be positive')
      .max(10000, 'Maximum spending limit is $10,000')
      .optional(),
    expiresIn: z.number()
      .int('Expiry days must be an integer')
      .min(1, 'Minimum expiry is 1 day')
      .max(365, 'Maximum expiry is 365 days')
      .optional(),
    merchantRestrictions: z.object({
      allowedCategories: z.array(z.string()).optional(),
      blockedCategories: z.array(z.string()).optional(),
      allowedMerchants: z.array(z.string()).optional(),
      blockedMerchants: z.array(z.string()).optional()
    }).optional()
  }).refine(
    data => !data.spendingLimit || data.spendingLimit <= data.fundingAmount,
    {
      message: 'Spending limit cannot exceed funding amount',
      path: ['spendingLimit']
    }
  )
});

// Update card limits schema
export const updateCardLimitsSchema = z.object({
  params: z.object({
    cardId: z.string().uuid('Invalid card ID format')
  }),
  body: z.object({
    spendingLimit: z.number()
      .positive('Spending limit must be positive')
      .max(10000, 'Maximum spending limit is $10,000')
  })
});

// Card ID parameter schema
export const cardIdParamSchema = z.object({
  params: z.object({
    cardId: z.string().uuid('Invalid card ID format')
  })
});

// Card transactions query schema
export const cardTransactionsQuerySchema = z.object({
  params: z.object({
    cardId: z.string().uuid('Invalid card ID format')
  }),
  query: z.object({
    page: z.string()
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0, 'Page must be positive')
      .optional()
      .default('1'),
    limit: z.string()
      .transform(val => parseInt(val, 10))
      .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
      .optional()
      .default('20')
  })
});