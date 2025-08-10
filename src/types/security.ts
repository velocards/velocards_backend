/**
 * Enhanced security type definitions with strict typing
 */

/**
 * Two-factor authentication method types
 */
export type TwoFactorMethod = 'totp' | 'sms' | 'email';

/**
 * Security event types for audit logging
 */
export type SecurityEventType = 
  | 'login_success' 
  | 'login_failed' 
  | 'logout' 
  | 'password_change' 
  | 'email_change'
  | '2fa_enabled' 
  | '2fa_disabled' 
  | '2fa_verified' 
  | '2fa_failed'
  | 'suspicious_activity' 
  | 'account_locked'
  | 'session_expired'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'backup_codes_used'
  | 'backup_codes_regenerated'
  | 'device_registered'
  | 'device_removed';

/**
 * Security audit log severity levels
 */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Device trust status
 */
export type DeviceTrustStatus = 'untrusted' | 'pending' | 'trusted' | 'revoked';

/**
 * Two-factor authentication data with enhanced typing
 */
export interface TwoFactorAuthData {
  id: string;
  userId: string;
  method: TwoFactorMethod;
  secret: string;
  backupCodes: string[];
  isEnabled: boolean;
  lastUsed: Date | null;
  setupInitiatedAt: Date | null;
  verificationAttempts: number;
  lastFailedAttempt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Enhanced user session with device information
 */
export interface UserSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceFingerprint: string | null;
  deviceInfo: {
    platform?: string;
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    isMobile: boolean;
  } | null;
  location: {
    ipAddress: string | null;
    country?: string;
    city?: string;
    timezone?: string;
  } | null;
  userAgent: string | null;
  isActive: boolean;
  twoFaVerified: boolean;
  trustLevel: DeviceTrustStatus;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Two-factor authentication setup response
 */
export interface TwoFactorSetupResponse {
  method: TwoFactorMethod;
  secret: string;
  qrCode: string;
  backupCodes: string[];
  setupToken: string;
}

/**
 * Two-factor authentication verification request
 */
export interface TwoFactorVerificationRequest {
  code: string;
  userId: string;
  method: TwoFactorMethod;
  setupToken?: string;
  trustDevice?: boolean;
}

/**
 * Enhanced session creation data
 */
export interface SessionCreateData {
  userId: string;
  refreshToken: string;
  deviceFingerprint?: string;
  deviceInfo?: UserSession['deviceInfo'];
  location?: UserSession['location'];
  userAgent?: string;
  twoFaVerified?: boolean;
  trustLevel?: DeviceTrustStatus;
}

/**
 * Backup code verification request
 */
export interface BackupCodeVerificationRequest {
  code: string;
  userId: string;
  invalidateOtherCodes?: boolean;
}

/**
 * Account recovery request with enhanced security
 */
export interface AccountRecoveryRequest {
  email: string;
  recoveryToken?: string;
  newBackupCodes?: boolean;
  deviceFingerprint?: string;
  challengeType?: 'email' | 'sms' | 'security_questions';
}

/**
 * Security audit event interface
 */
export interface SecurityAuditEvent {
  id: string;
  userId: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ipAddress: string | null;
  userAgent: string | null;
  deviceFingerprint: string | null;
  location?: {
    country?: string;
    city?: string;
    timezone?: string;
  };
  metadata: Record<string, unknown>;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Security audit service interface
 */
export interface SecurityAuditService {
  logSecurityEvent(event: Omit<SecurityAuditEvent, 'id' | 'timestamp'>): Promise<void>;
  getSecurityEvents(userId: string, filters?: {
    eventTypes?: SecurityEventType[];
    severity?: SecuritySeverity;
    dateRange?: { from: Date; to: Date };
    limit?: number;
    offset?: number;
  }): Promise<{
    events: SecurityAuditEvent[];
    total: number;
  }>;
  detectSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    riskScore: number;
    reasons: string[];
  }>;
}

/**
 * Session manager interface
 */
export interface SessionManager {
  createSession(data: SessionCreateData): Promise<UserSession>;
  validateSession(sessionId: string): Promise<UserSession | null>;
  invalidateSession(sessionId: string): Promise<void>;
  invalidateAllUserSessions(userId: string): Promise<void>;
  refreshSession(sessionId: string): Promise<UserSession>;
  updateSessionActivity(sessionId: string): Promise<void>;
  getActiveSessions(userId: string): Promise<UserSession[]>;
  cleanupExpiredSessions(): Promise<number>;
}

/**
 * Two-factor authentication service interface
 */
export interface TwoFactorService {
  setupTwoFactor(userId: string, method: TwoFactorMethod): Promise<TwoFactorSetupResponse>;
  verifyTwoFactor(request: TwoFactorVerificationRequest): Promise<{
    isValid: boolean;
    remainingBackupCodes?: number;
  }>;
  disableTwoFactor(userId: string): Promise<void>;
  regenerateBackupCodes(userId: string): Promise<string[]>;
  verifyBackupCode(request: BackupCodeVerificationRequest): Promise<boolean>;
  getTwoFactorStatus(userId: string): Promise<{
    isEnabled: boolean;
    method?: TwoFactorMethod;
    backupCodesRemaining: number;
    lastUsed?: Date;
  }>;
}

/**
 * Password security requirements
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  prohibitCommonPasswords: boolean;
  prohibitPersonalInfo: boolean;
}

/**
 * Password strength assessment
 */
export interface PasswordStrengthResult {
  score: number; // 0-100
  strength: 'very_weak' | 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
  meetRequirements: boolean;
}

/**
 * Account lockout information
 */
export interface AccountLockout {
  userId: string;
  reason: string;
  lockedAt: Date;
  unlockAt: Date | null;
  attemptCount: number;
  maxAttempts: number;
  lockDuration: number; // in seconds
}

/**
 * Trusted device management
 */
export interface TrustedDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  os?: string;
  location?: {
    country?: string;
    city?: string;
  };
  trustLevel: DeviceTrustStatus;
  trustedAt: Date | null;
  lastUsed: Date;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Security settings for user account
 */
export interface SecuritySettings {
  userId: string;
  twoFactorEnabled: boolean;
  twoFactorMethod?: TwoFactorMethod;
  sessionTimeout: number; // in seconds
  requireTwoFactorForSensitive: boolean;
  trustedDevicesEnabled: boolean;
  loginNotifications: boolean;
  suspiciousActivityAlerts: boolean;
  accountRecoveryMethod: 'email' | 'phone' | 'both';
  passwordChangeRequired: boolean;
  passwordExpiresAt: Date | null;
  updatedAt: Date;
}