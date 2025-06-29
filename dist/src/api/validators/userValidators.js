"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.balanceHistoryQuerySchema = exports.updateSettingsSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
// Profile update schema
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        firstName: zod_1.z.string().min(1).max(50).optional(),
        lastName: zod_1.z.string().min(1).max(50).optional(),
        phoneNumber: zod_1.z.string()
            .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
            .optional(),
        dateOfBirth: zod_1.z.string()
            .refine((date) => {
            const dob = new Date(date);
            const age = (new Date()).getFullYear() - dob.getFullYear();
            return age >= 18 && age <= 120;
        }, 'Must be between 18 and 120 years old')
            .optional(),
        address: zod_1.z.object({
            street: zod_1.z.string().min(1).max(100).optional(),
            city: zod_1.z.string().min(1).max(50).optional(),
            state: zod_1.z.string().min(1).max(50).optional(),
            postalCode: zod_1.z.string().min(1).max(20).optional(),
            country: zod_1.z.string().length(2, 'Country must be 2-letter ISO code').optional()
        }).optional()
    }).refine(data => Object.keys(data).length > 0, {
        message: 'At least one field must be provided for update'
    })
});
// Settings update schema
exports.updateSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        notifications: zod_1.z.object({
            email: zod_1.z.object({
                transactions: zod_1.z.boolean().optional(),
                security: zod_1.z.boolean().optional(),
                marketing: zod_1.z.boolean().optional(),
                updates: zod_1.z.boolean().optional()
            }).optional(),
            sms: zod_1.z.object({
                transactions: zod_1.z.boolean().optional(),
                security: zod_1.z.boolean().optional()
            }).optional(),
            push: zod_1.z.object({
                transactions: zod_1.z.boolean().optional(),
                security: zod_1.z.boolean().optional(),
                updates: zod_1.z.boolean().optional()
            }).optional()
        }).optional(),
        security: zod_1.z.object({
            twoFactorEnabled: zod_1.z.boolean().optional(),
            loginAlerts: zod_1.z.boolean().optional(),
            transactionAlerts: zod_1.z.boolean().optional(),
            ipWhitelisting: zod_1.z.boolean().optional(),
            allowedIps: zod_1.z.array(zod_1.z.string().ip()).optional()
        }).optional(),
        preferences: zod_1.z.object({
            language: zod_1.z.enum(['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko']).optional(),
            currency: zod_1.z.string().length(3, 'Currency must be 3-letter ISO code').optional(),
            timezone: zod_1.z.string().optional(),
            dateFormat: zod_1.z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
            theme: zod_1.z.enum(['light', 'dark', 'system']).optional()
        }).optional()
    }).refine(data => Object.keys(data).length > 0, {
        message: 'At least one setting must be provided for update'
    })
});
// Balance history query schema
exports.balanceHistoryQuerySchema = zod_1.z.object({
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
            .default('20'),
        from: zod_1.z.string()
            .refine(val => !isNaN(Date.parse(val)), 'Invalid date format')
            .optional(),
        to: zod_1.z.string()
            .refine(val => !isNaN(Date.parse(val)), 'Invalid date format')
            .optional(),
        type: zod_1.z.enum(['deposit', 'card_funding', 'refund', 'withdrawal', 'fee', 'adjustment', 'all'])
            .optional()
            .default('all'),
        sortBy: zod_1.z.enum(['created_at', 'amount'])
            .optional()
            .default('created_at'),
        sortOrder: zod_1.z.enum(['asc', 'desc'])
            .optional()
            .default('desc')
    })
});
//# sourceMappingURL=userValidators.js.map