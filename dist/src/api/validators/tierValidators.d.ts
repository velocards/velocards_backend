import { z } from 'zod';
export declare const calculateFeesSchema: z.ZodObject<{
    body: z.ZodObject<{
        action: z.ZodEnum<["card_creation", "deposit", "withdrawal"]>;
        amount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        action: "deposit" | "card_creation" | "withdrawal";
        amount?: number | undefined;
    }, {
        action: "deposit" | "card_creation" | "withdrawal";
        amount?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        action: "deposit" | "card_creation" | "withdrawal";
        amount?: number | undefined;
    };
}, {
    body: {
        action: "deposit" | "card_creation" | "withdrawal";
        amount?: number | undefined;
    };
}>;
//# sourceMappingURL=tierValidators.d.ts.map