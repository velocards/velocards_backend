import { z } from 'zod';

// Standard API Response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.any().optional()
    }).optional()
  });

// Pagination response wrapper
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number()
    })
  });

// Common response schemas
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.any().optional()
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  })
});

// Auth response schemas
export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.string(),
    emailVerified: z.boolean(),
    kycStatus: z.string()
  })
});

export const RefreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string()
});

// User response schemas
export const UserProfileResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
  kycStatus: z.string(),
  accountStatus: z.string(),
  virtualBalance: z.number(),
  role: z.string(),
  createdAt: z.date(),
  tier: z.object({
    id: z.string(),
    level: z.number(),
    name: z.string(),
    displayName: z.string(),
    description: z.string().optional(),
    features: z.any().optional()
  }).nullable(),
  tierAssignedAt: z.date().nullable(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional()
  }).nullable(),
  dateOfBirth: z.string().nullable()
});

// Card response schemas
export const CardResponseSchema = z.object({
  id: z.string(),
  cardToken: z.string(),
  maskedPan: z.string(),
  type: z.enum(['single_use', 'multi_use']),
  status: z.enum(['active', 'frozen', 'expired', 'deleted']),
  spendingLimit: z.number(),
  spentAmount: z.number(),
  remainingBalance: z.number(),
  currency: z.string(),
  nickname: z.string().optional(),
  merchantRestrictions: z.object({
    allowedCategories: z.array(z.string()).optional(),
    blockedCategories: z.array(z.string()).optional(),
    allowedMerchants: z.array(z.string()).optional(),
    blockedMerchants: z.array(z.string()).optional()
  }).optional(),
  expiresAt: z.date().optional(),
  createdAt: z.date()
});

export const CardListResponseSchema = PaginatedResponseSchema(CardResponseSchema);

// Transaction response schemas
export const TransactionResponseSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  amount: z.number(),
  currency: z.string(),
  merchantName: z.string(),
  merchantCategory: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'reversed', 'disputed']),
  type: z.enum(['authorization', 'capture', 'refund', 'reversal', 'deposit', 'withdrawal', 'fee']),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const TransactionListResponseSchema = PaginatedResponseSchema(TransactionResponseSchema);

// Crypto response schemas
export const CryptoOrderResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(['pending', 'confirming', 'completed', 'failed', 'expired']),
  paymentAddress: z.string().optional(),
  txHash: z.string().optional(),
  expiresAt: z.date().optional(),
  createdAt: z.date()
});

export const CryptoOrderListResponseSchema = PaginatedResponseSchema(CryptoOrderResponseSchema);

// Inferred TypeScript types
export type ApiResponse<T> = z.infer<ReturnType<typeof ApiResponseSchema<z.ZodType<T>>>>;
export type PaginatedResponse<T> = z.infer<ReturnType<typeof PaginatedResponseSchema<z.ZodType<T>>>>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshTokenResponse = z.infer<typeof RefreshTokenResponseSchema>;
export type UserProfileResponse = z.infer<typeof UserProfileResponseSchema>;
export type CardResponse = z.infer<typeof CardResponseSchema>;
export type CardListResponse = z.infer<typeof CardListResponseSchema>;
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;
export type TransactionListResponse = z.infer<typeof TransactionListResponseSchema>;
export type CryptoOrderResponse = z.infer<typeof CryptoOrderResponseSchema>;
export type CryptoOrderListResponse = z.infer<typeof CryptoOrderListResponseSchema>;