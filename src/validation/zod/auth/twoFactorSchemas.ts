import { z } from 'zod';

// TOTP code validation - must be 6 digits
export const totpCodeSchema = z.string()
  .regex(/^\d{6}$/, 'TOTP code must be exactly 6 digits')
  .transform(val => val.trim());

// Backup code validation - 8 alphanumeric characters
export const backupCodeSchema = z.string()
  .regex(/^[A-Z0-9]{8}$/, 'Backup code must be 8 alphanumeric characters')
  .transform(val => val.trim().toUpperCase());

// Password verification for sensitive operations
export const passwordVerificationSchema = z.object({
  password: z.string()
    .min(1, 'Password is required')
    .max(100, 'Password is too long')
});

// 2FA setup request schema
export const twoFactorSetupSchema = z.object({
  email: z.string().email('Valid email is required')
});

// 2FA enable request schema
export const twoFactorEnableSchema = z.object({
  totpCode: totpCodeSchema,
  password: z.string().min(1, 'Password is required')
});

// 2FA verify request schema (during login)
export const twoFactorVerifySchema = z.object({
  totpCode: totpCodeSchema
});

// Backup code verify request schema
export const backupCodeVerifySchema = z.object({
  backupCode: backupCodeSchema
});

// 2FA disable request schema
export const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string().optional()
});

// Account recovery request schema
export const accountRecoverySchema = z.object({
  email: z.string().email('Valid email is required')
});

// Account recovery verification schema
export const accountRecoveryVerifySchema = z.object({
  recoveryToken: z.string()
    .min(1, 'Recovery token is required')
    .max(100, 'Invalid recovery token'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number, and special character'
    )
});

// Session management schemas
export const deviceFingerprintSchema = z.object({
  screenResolution: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional()
});

export const sessionCreateSchema = z.object({
  deviceFingerprint: deviceFingerprintSchema.optional()
});

export const sessionRevokeSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID')
});

// Backup codes regeneration schema
export const backupCodesRegenerateSchema = z.object({
  password: z.string().min(1, 'Password is required')
});

// Rate limiting validation
export const rateLimitedRequestSchema = z.object({
  clientId: z.string().optional(),
  ipAddress: z.string().ip().optional()
});

// 2FA status response schema
export const twoFactorStatusSchema = z.object({
  isEnabled: z.boolean(),
  backupCodesRemaining: z.number().int().min(0),
  lastUsed: z.date().nullable(),
  setupDate: z.date().nullable()
});

// Error response schema
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  correlationId: z.string().optional()
});

// Success response schema
export const successResponseSchema = z.object({
  success: z.literal(true),
  data: z.any().optional(),
  message: z.string().optional()
});

// Combined response schema
export const apiResponseSchema = z.union([
  successResponseSchema,
  errorResponseSchema
]);

// Request context schema for security logging
export const requestContextSchema = z.object({
  userId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  correlationId: z.string().uuid()
});

// 2FA attempt logging schema
export const twoFactorAttemptSchema = z.object({
  userId: z.string().uuid(),
  attemptType: z.enum(['totp', 'backup_code', 'setup', 'disable']),
  success: z.boolean(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  timestamp: z.date().default(() => new Date())
});

export type TotpCodeInput = z.infer<typeof totpCodeSchema>;
export type BackupCodeInput = z.infer<typeof backupCodeSchema>;
export type PasswordVerificationInput = z.infer<typeof passwordVerificationSchema>;
export type TwoFactorSetupInput = z.infer<typeof twoFactorSetupSchema>;
export type TwoFactorEnableInput = z.infer<typeof twoFactorEnableSchema>;
export type TwoFactorVerifyInput = z.infer<typeof twoFactorVerifySchema>;
export type BackupCodeVerifyInput = z.infer<typeof backupCodeVerifySchema>;
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;
export type AccountRecoveryInput = z.infer<typeof accountRecoverySchema>;
export type AccountRecoveryVerifyInput = z.infer<typeof accountRecoveryVerifySchema>;
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
export type SessionRevokeInput = z.infer<typeof sessionRevokeSchema>;
export type BackupCodesRegenerateInput = z.infer<typeof backupCodesRegenerateSchema>;
export type RequestContextInput = z.infer<typeof requestContextSchema>;
export type TwoFactorAttemptInput = z.infer<typeof twoFactorAttemptSchema>;