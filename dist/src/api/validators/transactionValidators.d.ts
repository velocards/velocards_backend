import { z } from 'zod';
export declare const getTransactionHistorySchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        card_id: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodEnum<["authorization", "capture", "refund", "reversal", "deposit", "withdrawal", "fee"]>>;
        status: z.ZodOptional<z.ZodEnum<["pending", "completed", "failed", "reversed", "disputed"]>>;
        from_date: z.ZodOptional<z.ZodString>;
        to_date: z.ZodOptional<z.ZodString>;
        min_amount: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
        max_amount: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
        merchant_name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        limit: number;
        page: number;
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: number | undefined;
        max_amount?: number | undefined;
    }, {
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        limit?: string | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        page?: string | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: string | undefined;
        max_amount?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        limit: number;
        page: number;
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: number | undefined;
        max_amount?: number | undefined;
    };
}, {
    query: {
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        limit?: string | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        page?: string | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: string | undefined;
        max_amount?: string | undefined;
    };
}>;
export declare const getTransactionDetailsSchema: z.ZodObject<{
    params: z.ZodObject<{
        transactionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        transactionId: string;
    }, {
        transactionId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        transactionId: string;
    };
}, {
    params: {
        transactionId: string;
    };
}>;
export declare const getCardTransactionsSchema: z.ZodObject<{
    params: z.ZodObject<{
        cardId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
    }, {
        cardId: string;
    }>;
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
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
export declare const disputeTransactionSchema: z.ZodObject<{
    params: z.ZodObject<{
        transactionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        transactionId: string;
    }, {
        transactionId: string;
    }>;
    body: z.ZodObject<{
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
    }, {
        reason: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        reason: string;
    };
    params: {
        transactionId: string;
    };
}, {
    body: {
        reason: string;
    };
    params: {
        transactionId: string;
    };
}>;
export declare const exportTransactionsSchema: z.ZodObject<{
    query: z.ZodObject<{
        format: z.ZodDefault<z.ZodEnum<["csv", "json"]>>;
        card_id: z.ZodOptional<z.ZodString>;
        type: z.ZodOptional<z.ZodEnum<["authorization", "capture", "refund", "reversal", "deposit", "withdrawal", "fee"]>>;
        status: z.ZodOptional<z.ZodEnum<["pending", "completed", "failed", "reversed", "disputed"]>>;
        from_date: z.ZodOptional<z.ZodString>;
        to_date: z.ZodOptional<z.ZodString>;
        min_amount: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
        max_amount: z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>;
        merchant_name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        format: "json" | "csv";
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: number | undefined;
        max_amount?: number | undefined;
    }, {
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: string | undefined;
        max_amount?: string | undefined;
        format?: "json" | "csv" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        format: "json" | "csv";
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: number | undefined;
        max_amount?: number | undefined;
    };
}, {
    query: {
        type?: "deposit" | "withdrawal" | "fee" | "authorization" | "capture" | "refund" | "reversal" | undefined;
        status?: "pending" | "completed" | "failed" | "reversed" | "disputed" | undefined;
        card_id?: string | undefined;
        merchant_name?: string | undefined;
        from_date?: string | undefined;
        to_date?: string | undefined;
        min_amount?: string | undefined;
        max_amount?: string | undefined;
        format?: "json" | "csv" | undefined;
    };
}>;
export declare const createMockTransactionSchema: z.ZodObject<{
    body: z.ZodObject<{
        cardId: z.ZodString;
        amount: z.ZodOptional<z.ZodNumber>;
        merchantName: z.ZodOptional<z.ZodString>;
        merchantCategory: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        cardId: string;
        amount?: number | undefined;
        merchantName?: string | undefined;
        merchantCategory?: string | undefined;
    }, {
        cardId: string;
        amount?: number | undefined;
        merchantName?: string | undefined;
        merchantCategory?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        cardId: string;
        amount?: number | undefined;
        merchantName?: string | undefined;
        merchantCategory?: string | undefined;
    };
}, {
    body: {
        cardId: string;
        amount?: number | undefined;
        merchantName?: string | undefined;
        merchantCategory?: string | undefined;
    };
}>;
export declare const refinePagination: (data: any) => any;
//# sourceMappingURL=transactionValidators.d.ts.map