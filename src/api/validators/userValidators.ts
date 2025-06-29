import { z } from 'zod';

// Profile update schema
export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    phoneNumber: z.string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
      .optional(),
    dateOfBirth: z.string()
      .refine((date) => {
        const dob = new Date(date);
        const age = (new Date()).getFullYear() - dob.getFullYear();
        return age >= 18 && age <= 120;
      }, 'Must be between 18 and 120 years old')
      .optional(),
    address: z.object({
      street: z.string().min(1).max(100).optional(),
      city: z.string().min(1).max(50).optional(),
      state: z.string().min(1).max(50).optional(),
      postalCode: z.string().min(1).max(20).optional(),
      country: z.string().length(2, 'Country must be 2-letter ISO code').optional()
    }).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
});

// Settings update schema
export const updateSettingsSchema = z.object({
  body: z.object({
    notifications: z.object({
      email: z.object({
        transactions: z.boolean().optional(),
        security: z.boolean().optional(),
        marketing: z.boolean().optional(),
        updates: z.boolean().optional()
      }).optional(),
      sms: z.object({
        transactions: z.boolean().optional(),
        security: z.boolean().optional()
      }).optional(),
      push: z.object({
        transactions: z.boolean().optional(),
        security: z.boolean().optional(),
        updates: z.boolean().optional()
      }).optional()
    }).optional(),
    security: z.object({
      twoFactorEnabled: z.boolean().optional(),
      loginAlerts: z.boolean().optional(),
      transactionAlerts: z.boolean().optional(),
      ipWhitelisting: z.boolean().optional(),
      allowedIps: z.array(z.string().ip()).optional()
    }).optional(),
    preferences: z.object({
      language: z.enum(['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko']).optional(),
      currency: z.string().length(3, 'Currency must be 3-letter ISO code').optional(),
      timezone: z.string().optional(),
      dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
      theme: z.enum(['light', 'dark', 'system']).optional()
    }).optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one setting must be provided for update'
  })
});

// Balance history query schema
export const balanceHistoryQuerySchema = z.object({
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
      .default('20'),
    from: z.string()
      .refine(val => !isNaN(Date.parse(val)), 'Invalid date format')
      .optional(),
    to: z.string()
      .refine(val => !isNaN(Date.parse(val)), 'Invalid date format')
      .optional(),
    type: z.enum(['deposit', 'card_funding', 'refund', 'withdrawal', 'fee', 'adjustment', 'all'])
      .optional()
      .default('all'),
    sortBy: z.enum(['created_at', 'amount'])
      .optional()
      .default('created_at'),
    sortOrder: z.enum(['asc', 'desc'])
      .optional()
      .default('desc')
  })
});