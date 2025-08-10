import { z } from 'zod';
import { CommonValidators, sanitizedString } from '../../validation/zod/common/validators';

export const registerSchema = z.object({
  body: z.object({
    email: CommonValidators.email,
    password: CommonValidators.password,
    firstName: sanitizedString(1, 50),
    lastName: sanitizedString(1, 50),
    phone: CommonValidators.phoneNumber.optional(),
    captchaToken: z.string().optional() // Optional to maintain backward compatibility
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: CommonValidators.email,
    password: z.string().min(1, 'Password is required'),
    captchaToken: z.string().optional() // Optional to maintain backward compatibility
  })
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required').optional()
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: CommonValidators.email,
    captchaToken: z.string().optional() // Optional to maintain backward compatibility
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: CommonValidators.password
  })
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Verification token is required')
  })
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: CommonValidators.email
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: CommonValidators.password
  }).refine(
    (data) => data.oldPassword !== data.newPassword,
    {
      message: 'New password must be different from current password',
      path: ['newPassword']
    }
  )
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>['body'];