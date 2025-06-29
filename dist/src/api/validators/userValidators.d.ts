import { z } from 'zod';
export declare const updateProfileSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodOptional<z.ZodString>;
        phoneNumber: z.ZodOptional<z.ZodString>;
        dateOfBirth: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        address: z.ZodOptional<z.ZodObject<{
            street: z.ZodOptional<z.ZodString>;
            city: z.ZodOptional<z.ZodString>;
            state: z.ZodOptional<z.ZodString>;
            postalCode: z.ZodOptional<z.ZodString>;
            country: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        }, {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        firstName?: string | undefined;
        lastName?: string | undefined;
        address?: {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        } | undefined;
        phoneNumber?: string | undefined;
        dateOfBirth?: string | undefined;
    }, {
        firstName?: string | undefined;
        lastName?: string | undefined;
        address?: {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        } | undefined;
        phoneNumber?: string | undefined;
        dateOfBirth?: string | undefined;
    }>, {
        firstName?: string | undefined;
        lastName?: string | undefined;
        address?: {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        } | undefined;
        phoneNumber?: string | undefined;
        dateOfBirth?: string | undefined;
    }, {
        firstName?: string | undefined;
        lastName?: string | undefined;
        address?: {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        } | undefined;
        phoneNumber?: string | undefined;
        dateOfBirth?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        firstName?: string | undefined;
        lastName?: string | undefined;
        address?: {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        } | undefined;
        phoneNumber?: string | undefined;
        dateOfBirth?: string | undefined;
    };
}, {
    body: {
        firstName?: string | undefined;
        lastName?: string | undefined;
        address?: {
            street?: string | undefined;
            city?: string | undefined;
            state?: string | undefined;
            postalCode?: string | undefined;
            country?: string | undefined;
        } | undefined;
        phoneNumber?: string | undefined;
        dateOfBirth?: string | undefined;
    };
}>;
export declare const updateSettingsSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        notifications: z.ZodOptional<z.ZodObject<{
            email: z.ZodOptional<z.ZodObject<{
                transactions: z.ZodOptional<z.ZodBoolean>;
                security: z.ZodOptional<z.ZodBoolean>;
                marketing: z.ZodOptional<z.ZodBoolean>;
                updates: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            }, {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            }>>;
            sms: z.ZodOptional<z.ZodObject<{
                transactions: z.ZodOptional<z.ZodBoolean>;
                security: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            }, {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            }>>;
            push: z.ZodOptional<z.ZodObject<{
                transactions: z.ZodOptional<z.ZodBoolean>;
                security: z.ZodOptional<z.ZodBoolean>;
                updates: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            }, {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        }, {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        }>>;
        security: z.ZodOptional<z.ZodObject<{
            twoFactorEnabled: z.ZodOptional<z.ZodBoolean>;
            loginAlerts: z.ZodOptional<z.ZodBoolean>;
            transactionAlerts: z.ZodOptional<z.ZodBoolean>;
            ipWhitelisting: z.ZodOptional<z.ZodBoolean>;
            allowedIps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        }, {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        }>>;
        preferences: z.ZodOptional<z.ZodObject<{
            language: z.ZodOptional<z.ZodEnum<["en", "es", "fr", "de", "pt", "zh", "ja", "ko"]>>;
            currency: z.ZodOptional<z.ZodString>;
            timezone: z.ZodOptional<z.ZodString>;
            dateFormat: z.ZodOptional<z.ZodEnum<["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]>>;
            theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
        }, "strip", z.ZodTypeAny, {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        }, {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        security?: {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        } | undefined;
        notifications?: {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        } | undefined;
        preferences?: {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        } | undefined;
    }, {
        security?: {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        } | undefined;
        notifications?: {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        } | undefined;
        preferences?: {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        } | undefined;
    }>, {
        security?: {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        } | undefined;
        notifications?: {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        } | undefined;
        preferences?: {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        } | undefined;
    }, {
        security?: {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        } | undefined;
        notifications?: {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        } | undefined;
        preferences?: {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        security?: {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        } | undefined;
        notifications?: {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        } | undefined;
        preferences?: {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        } | undefined;
    };
}, {
    body: {
        security?: {
            twoFactorEnabled?: boolean | undefined;
            loginAlerts?: boolean | undefined;
            transactionAlerts?: boolean | undefined;
            ipWhitelisting?: boolean | undefined;
            allowedIps?: string[] | undefined;
        } | undefined;
        notifications?: {
            push?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            email?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
                marketing?: boolean | undefined;
                updates?: boolean | undefined;
            } | undefined;
            sms?: {
                transactions?: boolean | undefined;
                security?: boolean | undefined;
            } | undefined;
        } | undefined;
        preferences?: {
            currency?: string | undefined;
            language?: "de" | "fr" | "en" | "es" | "pt" | "zh" | "ja" | "ko" | undefined;
            timezone?: string | undefined;
            dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD" | undefined;
            theme?: "light" | "dark" | "system" | undefined;
        } | undefined;
    };
}>;
export declare const balanceHistoryQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, number, string>, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, number, string>, number, string>>>;
        from: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        to: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        type: z.ZodDefault<z.ZodOptional<z.ZodEnum<["deposit", "card_funding", "refund", "withdrawal", "fee", "adjustment", "all"]>>>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["created_at", "amount"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        type: "deposit" | "card_funding" | "withdrawal" | "fee" | "all" | "refund" | "adjustment";
        limit: number;
        page: number;
        sortBy: "created_at" | "amount";
        sortOrder: "desc" | "asc";
        from?: string | undefined;
        to?: string | undefined;
    }, {
        type?: "deposit" | "card_funding" | "withdrawal" | "fee" | "all" | "refund" | "adjustment" | undefined;
        limit?: string | undefined;
        from?: string | undefined;
        to?: string | undefined;
        page?: string | undefined;
        sortBy?: "created_at" | "amount" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        type: "deposit" | "card_funding" | "withdrawal" | "fee" | "all" | "refund" | "adjustment";
        limit: number;
        page: number;
        sortBy: "created_at" | "amount";
        sortOrder: "desc" | "asc";
        from?: string | undefined;
        to?: string | undefined;
    };
}, {
    query: {
        type?: "deposit" | "card_funding" | "withdrawal" | "fee" | "all" | "refund" | "adjustment" | undefined;
        limit?: string | undefined;
        from?: string | undefined;
        to?: string | undefined;
        page?: string | undefined;
        sortBy?: "created_at" | "amount" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    };
}>;
//# sourceMappingURL=userValidators.d.ts.map