export interface TwoFactorAuthData {
  id: string;
  userId: string;
  secret: string;
  backupCodes: string[];
  isEnabled: boolean;
  lastUsed: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isActive: boolean;
  twoFaVerified: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface TwoFactorVerificationRequest {
  code: string;
  userId: string;
}

export interface SessionCreateData {
  userId: string;
  refreshToken: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  twoFaVerified?: boolean;
}

export interface BackupCodeVerificationRequest {
  code: string;
  userId: string;
}

export interface AccountRecoveryRequest {
  email: string;
  recoveryToken?: string;
  newBackupCodes?: boolean;
}