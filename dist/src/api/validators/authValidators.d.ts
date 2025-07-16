import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        captchaToken: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string | undefined;
        captchaToken?: string | undefined;
    }, {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string | undefined;
        captchaToken?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string | undefined;
        captchaToken?: string | undefined;
    };
}, {
    body: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string | undefined;
        captchaToken?: string | undefined;
    };
}>;
export declare const loginSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        captchaToken: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
        captchaToken?: string | undefined;
    }, {
        email: string;
        password: string;
        captchaToken?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        password: string;
        captchaToken?: string | undefined;
    };
}, {
    body: {
        email: string;
        password: string;
        captchaToken?: string | undefined;
    };
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    body: z.ZodObject<{
        refreshToken: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        refreshToken: string;
    }, {
        refreshToken: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        refreshToken: string;
    };
}, {
    body: {
        refreshToken: string;
    };
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        captchaToken: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        email: string;
        captchaToken?: string | undefined;
    }, {
        email: string;
        captchaToken?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        captchaToken?: string | undefined;
    };
}, {
    body: {
        email: string;
        captchaToken?: string | undefined;
    };
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    body: z.ZodObject<{
        token: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        password: string;
        token: string;
    }, {
        password: string;
        token: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        password: string;
        token: string;
    };
}, {
    body: {
        password: string;
        token: string;
    };
}>;
export declare const verifyEmailSchema: z.ZodObject<{
    body: z.ZodObject<{
        token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        token: string;
    }, {
        token: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        token: string;
    };
}, {
    body: {
        token: string;
    };
}>;
export declare const resendVerificationSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
    }, {
        email: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
    };
}, {
    body: {
        email: string;
    };
}>;
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>['body'];
//# sourceMappingURL=authValidators.d.ts.map