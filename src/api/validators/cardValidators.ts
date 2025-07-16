import { z } from 'zod';

// US State codes
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
] as const;

// Supported country codes
const SUPPORTED_COUNTRIES = ['US'] as const; // Add more as Admediacards supports

// Phone number regex for E.164 format
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

// Name validation regex (letters, spaces, hyphens, apostrophes)
const NAME_REGEX = /^[a-zA-Z\s\-']+$/;

// Postal code regex (US format)
const US_POSTAL_REGEX = /^\d{5}(-\d{4})?$/;

// Create card schema
export const createCardSchema = z.object({
  body: z.object({
    // Card Configuration
    type: z.enum(['single_use', 'multi_use']),
    programId: z.number()
      .int('Program ID must be an integer')
      .positive('Program ID must be positive'),
    fundingAmount: z.number()
      .positive('Funding amount must be positive')
      .min(10, 'Minimum funding amount is $10')
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
    
    // Cardholder Information - ALL REQUIRED
    firstName: z.string()
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name cannot exceed 50 characters')
      .regex(NAME_REGEX, 'First name can only contain letters, spaces, hyphens, and apostrophes')
      .trim(),
    lastName: z.string()
      .min(2, 'Last name must be at least 2 characters')
      .max(50, 'Last name cannot exceed 50 characters')
      .regex(NAME_REGEX, 'Last name can only contain letters, spaces, hyphens, and apostrophes')
      .trim(),
    phoneNumber: z.string()
      .regex(E164_PHONE_REGEX, 'Phone number must be in international format (e.g., +1234567890)'),
    
    // Billing Address - ALL REQUIRED
    streetAddress: z.string()
      .min(5, 'Street address must be at least 5 characters')
      .max(255, 'Street address cannot exceed 255 characters')
      .trim(),
    city: z.string()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City cannot exceed 100 characters')
      .regex(/^[a-zA-Z\s\-'.]+$/, 'City can only contain letters and common punctuation')
      .trim(),
    state: z.enum(US_STATES, {
      errorMap: () => ({ message: 'Please provide a valid 2-letter US state code' })
    }),
    postalCode: z.string()
      .regex(US_POSTAL_REGEX, 'Please provide a valid US ZIP code (e.g., 12345 or 12345-6789)'),
    country: z.enum(SUPPORTED_COUNTRIES, {
      errorMap: () => ({ message: 'Please provide a valid 2-letter country code' })
    }),
    
    // Optional Fields
    nickname: z.string()
      .max(100, 'Nickname cannot exceed 100 characters')
      .trim()
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

// Create card session schema
export const createCardSessionSchema = z.object({
  params: z.object({
    cardId: z.string().uuid('Invalid card ID format')
  }),
  body: z.object({
    purpose: z.enum(['view_pan', 'view_cvv', 'view_full'], {
      errorMap: () => ({ message: 'Purpose must be one of: view_pan, view_cvv, view_full' })
    })
  })
});

// Get secure card details schema
export const getSecureCardDetailsSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
    token: z.string().min(64).max(64, 'Invalid token format'),
    field: z.string().optional() // Not used but kept for future flexibility
  })
});