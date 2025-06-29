"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardTransactionsQuerySchema = exports.cardIdParamSchema = exports.updateCardLimitsSchema = exports.createCardSchema = void 0;
const zod_1 = require("zod");
// US State codes
const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC'
];
// Supported country codes
const SUPPORTED_COUNTRIES = ['US']; // Add more as Admediacards supports
// Phone number regex for E.164 format
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
// Name validation regex (letters, spaces, hyphens, apostrophes)
const NAME_REGEX = /^[a-zA-Z\s\-']+$/;
// Postal code regex (US format)
const US_POSTAL_REGEX = /^\d{5}(-\d{4})?$/;
// Create card schema
exports.createCardSchema = zod_1.z.object({
    body: zod_1.z.object({
        // Card Configuration
        type: zod_1.z.enum(['single_use', 'multi_use']),
        programId: zod_1.z.number()
            .int('Program ID must be an integer')
            .positive('Program ID must be positive'),
        fundingAmount: zod_1.z.number()
            .positive('Funding amount must be positive')
            .min(10, 'Minimum funding amount is $10')
            .max(10000, 'Maximum funding amount is $10,000'),
        spendingLimit: zod_1.z.number()
            .positive('Spending limit must be positive')
            .max(10000, 'Maximum spending limit is $10,000')
            .optional(),
        expiresIn: zod_1.z.number()
            .int('Expiry days must be an integer')
            .min(1, 'Minimum expiry is 1 day')
            .max(365, 'Maximum expiry is 365 days')
            .optional(),
        // Cardholder Information - ALL REQUIRED
        firstName: zod_1.z.string()
            .min(2, 'First name must be at least 2 characters')
            .max(50, 'First name cannot exceed 50 characters')
            .regex(NAME_REGEX, 'First name can only contain letters, spaces, hyphens, and apostrophes')
            .trim(),
        lastName: zod_1.z.string()
            .min(2, 'Last name must be at least 2 characters')
            .max(50, 'Last name cannot exceed 50 characters')
            .regex(NAME_REGEX, 'Last name can only contain letters, spaces, hyphens, and apostrophes')
            .trim(),
        phoneNumber: zod_1.z.string()
            .regex(E164_PHONE_REGEX, 'Phone number must be in international format (e.g., +1234567890)'),
        // Billing Address - ALL REQUIRED
        streetAddress: zod_1.z.string()
            .min(5, 'Street address must be at least 5 characters')
            .max(255, 'Street address cannot exceed 255 characters')
            .trim(),
        city: zod_1.z.string()
            .min(2, 'City must be at least 2 characters')
            .max(100, 'City cannot exceed 100 characters')
            .regex(/^[a-zA-Z\s\-'.]+$/, 'City can only contain letters and common punctuation')
            .trim(),
        state: zod_1.z.enum(US_STATES, {
            errorMap: () => ({ message: 'Please provide a valid 2-letter US state code' })
        }),
        postalCode: zod_1.z.string()
            .regex(US_POSTAL_REGEX, 'Please provide a valid US ZIP code (e.g., 12345 or 12345-6789)'),
        country: zod_1.z.enum(SUPPORTED_COUNTRIES, {
            errorMap: () => ({ message: 'Please provide a valid 2-letter country code' })
        }),
        // Optional Fields
        nickname: zod_1.z.string()
            .max(100, 'Nickname cannot exceed 100 characters')
            .trim()
            .optional(),
        merchantRestrictions: zod_1.z.object({
            allowedCategories: zod_1.z.array(zod_1.z.string()).optional(),
            blockedCategories: zod_1.z.array(zod_1.z.string()).optional(),
            allowedMerchants: zod_1.z.array(zod_1.z.string()).optional(),
            blockedMerchants: zod_1.z.array(zod_1.z.string()).optional()
        }).optional()
    }).refine(data => !data.spendingLimit || data.spendingLimit <= data.fundingAmount, {
        message: 'Spending limit cannot exceed funding amount',
        path: ['spendingLimit']
    })
});
// Update card limits schema
exports.updateCardLimitsSchema = zod_1.z.object({
    params: zod_1.z.object({
        cardId: zod_1.z.string().uuid('Invalid card ID format')
    }),
    body: zod_1.z.object({
        spendingLimit: zod_1.z.number()
            .positive('Spending limit must be positive')
            .max(10000, 'Maximum spending limit is $10,000')
    })
});
// Card ID parameter schema
exports.cardIdParamSchema = zod_1.z.object({
    params: zod_1.z.object({
        cardId: zod_1.z.string().uuid('Invalid card ID format')
    })
});
// Card transactions query schema
exports.cardTransactionsQuerySchema = zod_1.z.object({
    params: zod_1.z.object({
        cardId: zod_1.z.string().uuid('Invalid card ID format')
    }),
    query: zod_1.z.object({
        page: zod_1.z.string()
            .transform(val => parseInt(val, 10))
            .refine(val => val > 0, 'Page must be positive')
            .optional()
            .default('1'),
        limit: zod_1.z.string()
            .transform(val => parseInt(val, 10))
            .refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100')
            .optional()
            .default('20')
    })
});
//# sourceMappingURL=cardValidators.js.map