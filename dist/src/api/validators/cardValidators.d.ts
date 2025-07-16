import { z } from 'zod';
export declare const createCardSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        type: z.ZodEnum<["single_use", "multi_use"]>;
        programId: z.ZodNumber;
        fundingAmount: z.ZodNumber;
        spendingLimit: z.ZodOptional<z.ZodNumber>;
        expiresIn: z.ZodOptional<z.ZodNumber>;
        firstName: z.ZodString;
        lastName: z.ZodString;
        phoneNumber: z.ZodString;
        streetAddress: z.ZodString;
        city: z.ZodString;
        state: z.ZodEnum<["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"]>;
        postalCode: z.ZodString;
        country: z.ZodEnum<["US"]>;
        nickname: z.ZodOptional<z.ZodString>;
        merchantRestrictions: z.ZodOptional<z.ZodObject<{
            allowedCategories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            blockedCategories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            allowedMerchants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            blockedMerchants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        }, {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "single_use" | "multi_use";
        firstName: string;
        lastName: string;
        state: "NY" | "MS" | "OK" | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NC" | "ND" | "OH" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY" | "DC";
        phoneNumber: string;
        city: string;
        postalCode: string;
        country: "US";
        programId: number;
        fundingAmount: number;
        streetAddress: string;
        nickname?: string | undefined;
        spendingLimit?: number | undefined;
        expiresIn?: number | undefined;
        merchantRestrictions?: {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        } | undefined;
    }, {
        type: "single_use" | "multi_use";
        firstName: string;
        lastName: string;
        state: "NY" | "MS" | "OK" | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NC" | "ND" | "OH" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY" | "DC";
        phoneNumber: string;
        city: string;
        postalCode: string;
        country: "US";
        programId: number;
        fundingAmount: number;
        streetAddress: string;
        nickname?: string | undefined;
        spendingLimit?: number | undefined;
        expiresIn?: number | undefined;
        merchantRestrictions?: {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        } | undefined;
    }>, {
        type: "single_use" | "multi_use";
        firstName: string;
        lastName: string;
        state: "NY" | "MS" | "OK" | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NC" | "ND" | "OH" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY" | "DC";
        phoneNumber: string;
        city: string;
        postalCode: string;
        country: "US";
        programId: number;
        fundingAmount: number;
        streetAddress: string;
        nickname?: string | undefined;
        spendingLimit?: number | undefined;
        expiresIn?: number | undefined;
        merchantRestrictions?: {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        } | undefined;
    }, {
        type: "single_use" | "multi_use";
        firstName: string;
        lastName: string;
        state: "NY" | "MS" | "OK" | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NC" | "ND" | "OH" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY" | "DC";
        phoneNumber: string;
        city: string;
        postalCode: string;
        country: "US";
        programId: number;
        fundingAmount: number;
        streetAddress: string;
        nickname?: string | undefined;
        spendingLimit?: number | undefined;
        expiresIn?: number | undefined;
        merchantRestrictions?: {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        type: "single_use" | "multi_use";
        firstName: string;
        lastName: string;
        state: "NY" | "MS" | "OK" | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NC" | "ND" | "OH" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY" | "DC";
        phoneNumber: string;
        city: string;
        postalCode: string;
        country: "US";
        programId: number;
        fundingAmount: number;
        streetAddress: string;
        nickname?: string | undefined;
        spendingLimit?: number | undefined;
        expiresIn?: number | undefined;
        merchantRestrictions?: {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        } | undefined;
    };
}, {
    body: {
        type: "single_use" | "multi_use";
        firstName: string;
        lastName: string;
        state: "NY" | "MS" | "OK" | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NC" | "ND" | "OH" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY" | "DC";
        phoneNumber: string;
        city: string;
        postalCode: string;
        country: "US";
        programId: number;
        fundingAmount: number;
        streetAddress: string;
        nickname?: string | undefined;
        spendingLimit?: number | undefined;
        expiresIn?: number | undefined;
        merchantRestrictions?: {
            allowedCategories?: string[] | undefined;
            blockedCategories?: string[] | undefined;
            allowedMerchants?: string[] | undefined;
            blockedMerchants?: string[] | undefined;
        } | undefined;
    };
}>;
export declare const updateCardLimitsSchema: z.ZodObject<{
    params: z.ZodObject<{
        cardId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
    }, {
        cardId: string;
    }>;
    body: z.ZodObject<{
        spendingLimit: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        spendingLimit: number;
    }, {
        spendingLimit: number;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        spendingLimit: number;
    };
    params: {
        cardId: string;
    };
}, {
    body: {
        spendingLimit: number;
    };
    params: {
        cardId: string;
    };
}>;
export declare const cardIdParamSchema: z.ZodObject<{
    params: z.ZodObject<{
        cardId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
    }, {
        cardId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        cardId: string;
    };
}, {
    params: {
        cardId: string;
    };
}>;
export declare const cardTransactionsQuerySchema: z.ZodObject<{
    params: z.ZodObject<{
        cardId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
    }, {
        cardId: string;
    }>;
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, number, string>, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, number, string>, number, string>>>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
    }, {
        limit?: string | undefined;
        page?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        cardId: string;
    };
    query: {
        limit: number;
        page: number;
    };
}, {
    params: {
        cardId: string;
    };
    query: {
        limit?: string | undefined;
        page?: string | undefined;
    };
}>;
//# sourceMappingURL=cardValidators.d.ts.map