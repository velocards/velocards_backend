/**
 * Integration between type guards and Zod schemas
 * Provides runtime type checking that complements Zod validation
 */

import { z } from 'zod';
import * as guards from '../utils/typeGuards';

/**
 * Create a type guard from a Zod schema
 */
export function createGuardFromSchema<T>(
  schema: z.ZodType<T>
): (value: unknown) => value is T {
  return (value: unknown): value is T => {
    const result = schema.safeParse(value);
    return result.success;
  };
}

/**
 * Validate and narrow type using Zod schema
 */
export function validateWithGuard<T>(
  value: unknown,
  schema: z.ZodType<T>
): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Assert type using Zod schema (throws on failure)
 */
export function assertWithSchema<T>(
  value: unknown,
  schema: z.ZodType<T>,
  message?: string
): asserts value is T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(message || `Validation failed: ${errors}`);
  }
}

/**
 * Common API request body guards
 */
export const LoginRequestGuard = createGuardFromSchema(
  z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
);

export const RegisterRequestGuard = createGuardFromSchema(
  z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(2),
    referralCode: z.string().optional()
  })
);

export const CreateCardRequestGuard = createGuardFromSchema(
  z.object({
    cardName: z.string().min(1).max(50),
    cardType: z.enum(['virtual', 'physical']),
    currency: z.string().length(3)
  })
);

/**
 * External API response guards with Zod
 */
export const AdMediaCardsResponseGuard = createGuardFromSchema(
  z.object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    code: z.number().optional()
  })
);

export const XMoneyResponseGuard = createGuardFromSchema(
  z.object({
    status: z.string(),
    orderId: z.string().optional(),
    message: z.string().optional(),
    data: z.unknown().optional()
  })
);

export const SumSubResponseGuard = createGuardFromSchema(
  z.object({
    id: z.string(),
    createdAt: z.string(),
    clientId: z.string(),
    inspectionId: z.string(),
    externalUserId: z.string(),
    info: z.object({}).passthrough().optional(),
    review: z.object({
      reviewResult: z.object({
        reviewAnswer: z.enum(['GREEN', 'RED', 'YELLOW'])
      }).optional()
    }).optional()
  })
);

/**
 * Database model guards
 */
export const UserProfileGuard = createGuardFromSchema(
  z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    full_name: z.string(),
    phone: z.string().nullable(),
    country: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string().nullable(),
    is_active: z.boolean(),
    is_verified: z.boolean(),
    kyc_status: z.enum(['not_started', 'pending', 'approved', 'rejected']),
    tier_id: z.string().uuid().nullable()
  })
);

export const CardGuard = createGuardFromSchema(
  z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    card_name: z.string(),
    card_number: z.string(),
    card_type: z.enum(['virtual', 'physical']),
    status: z.enum(['active', 'inactive', 'frozen', 'terminated']),
    currency: z.string(),
    balance: z.number(),
    created_at: z.string(),
    updated_at: z.string().nullable()
  })
);

/**
 * Composite guards for complex validation
 */
export function isValidApiRequest(value: unknown): value is { 
  headers: Record<string, unknown>
} {
  return guards.isObject(value) && 
         guards.hasProperty(value, 'headers') &&
         guards.isObject(value['headers']);
}

export function isAuthenticatedRequest(value: unknown): value is { 
  headers: Record<string, unknown> & { authorization: string },
  user?: { id: string }
} {
  return isValidApiRequest(value) &&
         guards.hasProperty(value, 'headers') &&
         guards.isObject(value['headers']) &&
         guards.hasProperty(value['headers'], 'authorization') &&
         guards.isString(value['headers']['authorization']) &&
         guards.isJWT(value['headers']['authorization'].replace('Bearer ', ''));
}

/**
 * Guards for sanitizing user input
 */
export function sanitizeAndValidateEmail(value: unknown): string | null {
  if (!guards.isString(value)) return null;
  const trimmed = value.trim().toLowerCase();
  return guards.isEmail(trimmed) ? trimmed : null;
}

export function sanitizeAndValidatePhone(value: unknown): string | null {
  if (!guards.isString(value)) return null;
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15 ? cleaned : null;
}

/**
 * Guards for financial operations
 */
export function isValidTransactionAmount(value: unknown): value is number {
  return guards.isValidAmount(value) && value <= 1000000; // Max 1M
}

export function isValidCardBalance(value: unknown): value is number {
  return guards.isNumber(value) && value >= 0 && value <= 1000000;
}

export function isValidExchangeRate(value: unknown): value is number {
  return guards.isNumber(value) && value > 0 && value < 1000000;
}

/**
 * Type-safe error handling for external APIs
 */
export function handleExternalApiResponse<T>(
  response: unknown,
  expectedSchema: z.ZodType<T>
): T {
  if (!guards.isObject(response)) {
    throw new Error('Invalid API response: not an object');
  }

  const result = expectedSchema.safeParse(response);
  if (!result.success) {
    const errors = result.error.errors.map(e => 
      `${e.path.join('.')}: ${e.message}`
    ).join(', ');
    throw new Error(`API response validation failed: ${errors}`);
  }

  return result.data;
}

/**
 * Batch validation with type guards
 */
export function validateBatch<T>(
  items: unknown[],
  guard: (item: unknown) => item is T
): { valid: T[], invalid: unknown[] } {
  const valid: T[] = [];
  const invalid: unknown[] = [];

  for (const item of items) {
    if (guard(item)) {
      valid.push(item);
    } else {
      invalid.push(item);
    }
  }

  return { valid, invalid };
}

/**
 * Create a guard that validates against multiple schemas (OR logic)
 */
export function createUnionGuard<T extends readonly z.ZodType[]>(
  ...schemas: T
): (value: unknown) => value is z.infer<T[number]> {
  return (value: unknown): value is z.infer<T[number]> => {
    return schemas.some(schema => schema.safeParse(value).success);
  };
}

/**
 * Create a guard that validates against all schemas (AND logic)
 */
export function createIntersectionGuard<T extends readonly z.ZodType[]>(
  ...schemas: T
): (value: unknown) => value is z.infer<T[number]> {
  return (value: unknown): value is z.infer<T[number]> => {
    return schemas.every(schema => schema.safeParse(value).success);
  };
}