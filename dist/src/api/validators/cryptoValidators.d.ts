import { z } from 'zod';
export declare const createDepositOrderSchema: z.ZodObject<{
    body: z.ZodObject<{
        amount: z.ZodNumber;
        currency: z.ZodLiteral<"USD">;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        currency: "USD";
    }, {
        amount: number;
        currency: "USD";
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        amount: number;
        currency: "USD";
    };
}, {
    body: {
        amount: number;
        currency: "USD";
    };
}>;
export declare const getDepositHistorySchema: z.ZodObject<{
    query: z.ZodEffects<z.ZodObject<{
        page: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodOptional<z.ZodString>, number, string | undefined>;
        status: z.ZodOptional<z.ZodEnum<["pending", "confirming", "completed", "failed"]>>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        status?: "pending" | "confirming" | "completed" | "failed" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        limit?: string | undefined;
        status?: "pending" | "confirming" | "completed" | "failed" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        page?: string | undefined;
    }>, {
        limit: number;
        page: number;
        status?: "pending" | "confirming" | "completed" | "failed" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        limit?: string | undefined;
        status?: "pending" | "confirming" | "completed" | "failed" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        page?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        status?: "pending" | "confirming" | "completed" | "failed" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}, {
    query: {
        limit?: string | undefined;
        status?: "pending" | "confirming" | "completed" | "failed" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        page?: string | undefined;
    };
}>;
export declare const createWithdrawalSchema: z.ZodObject<{
    body: z.ZodObject<{
        amount: z.ZodNumber;
        currency: z.ZodEnum<["BTC", "ETH", "USDT", "USDC", "BNB", "XRP", "ADA", "DOGE", "MATIC", "SOL"]>;
        address: z.ZodString;
        network: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        currency: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL";
        address: string;
        network?: string | undefined;
    }, {
        amount: number;
        currency: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL";
        address: string;
        network?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        amount: number;
        currency: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL";
        address: string;
        network?: string | undefined;
    };
}, {
    body: {
        amount: number;
        currency: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL";
        address: string;
        network?: string | undefined;
    };
}>;
export declare const getExchangeRatesSchema: z.ZodObject<{
    query: z.ZodEffects<z.ZodObject<{
        from: z.ZodOptional<z.ZodEnum<["BTC", "ETH", "USDT", "USDC", "BNB", "XRP", "ADA", "DOGE", "MATIC", "SOL"]>>;
        to: z.ZodOptional<z.ZodLiteral<"USD">>;
    }, "strip", z.ZodTypeAny, {
        from?: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL" | undefined;
        to?: "USD" | undefined;
    }, {
        from?: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL" | undefined;
        to?: "USD" | undefined;
    }>, {
        from?: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL" | undefined;
        to?: "USD" | undefined;
    }, {
        from?: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL" | undefined;
        to?: "USD" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        from?: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL" | undefined;
        to?: "USD" | undefined;
    };
}, {
    query: {
        from?: "BTC" | "ETH" | "USDT" | "USDC" | "DOGE" | "XRP" | "BNB" | "ADA" | "MATIC" | "SOL" | undefined;
        to?: "USD" | undefined;
    };
}>;
export declare const getOrderStatusSchema: z.ZodObject<{
    params: z.ZodObject<{
        orderId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        orderId: string;
    }, {
        orderId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        orderId: string;
    };
}, {
    params: {
        orderId: string;
    };
}>;
export declare const webhookPayloadSchema: z.ZodObject<{
    body: z.ZodObject<{
        event_type: z.ZodEnum<["ORDER.PAYMENT.DETECTED", "ORDER.PAYMENT.RECEIVED", "ORDER.PAYMENT.CANCELLED"]>;
        resource: z.ZodObject<{
            reference: z.ZodString;
            amount: z.ZodString;
            currency: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            amount: string;
            currency: string;
            reference: string;
        }, {
            amount: string;
            currency: string;
            reference: string;
        }>;
        signature: z.ZodString;
        state: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        signature: string;
        event_type: "ORDER.PAYMENT.DETECTED" | "ORDER.PAYMENT.RECEIVED" | "ORDER.PAYMENT.CANCELLED";
        resource: {
            amount: string;
            currency: string;
            reference: string;
        };
        state?: string | undefined;
    }, {
        signature: string;
        event_type: "ORDER.PAYMENT.DETECTED" | "ORDER.PAYMENT.RECEIVED" | "ORDER.PAYMENT.CANCELLED";
        resource: {
            amount: string;
            currency: string;
            reference: string;
        };
        state?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        signature: string;
        event_type: "ORDER.PAYMENT.DETECTED" | "ORDER.PAYMENT.RECEIVED" | "ORDER.PAYMENT.CANCELLED";
        resource: {
            amount: string;
            currency: string;
            reference: string;
        };
        state?: string | undefined;
    };
}, {
    body: {
        signature: string;
        event_type: "ORDER.PAYMENT.DETECTED" | "ORDER.PAYMENT.RECEIVED" | "ORDER.PAYMENT.CANCELLED";
        resource: {
            amount: string;
            currency: string;
            reference: string;
        };
        state?: string | undefined;
    };
}>;
export type CreateDepositOrderInput = z.infer<typeof createDepositOrderSchema>['body'];
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>['body'];
export type GetDepositHistoryQuery = z.infer<typeof getDepositHistorySchema>['query'];
export type GetExchangeRatesQuery = z.infer<typeof getExchangeRatesSchema>['query'];
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>['body'];
//# sourceMappingURL=cryptoValidators.d.ts.map