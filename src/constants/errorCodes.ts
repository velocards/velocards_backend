/**
 * Standardized error codes and messages
 * Provides consistent error identification across the application
 */

export enum ErrorCode {
  // Authentication errors (1000-1099)
  AUTH_INVALID_CREDENTIALS = 'AUTH_001',
  AUTH_TOKEN_EXPIRED = 'AUTH_002',
  AUTH_TOKEN_INVALID = 'AUTH_003',
  AUTH_REFRESH_TOKEN_INVALID = 'AUTH_004',
  AUTH_SESSION_EXPIRED = 'AUTH_005',
  AUTH_UNAUTHORIZED = 'AUTH_006',
  AUTH_2FA_REQUIRED = 'AUTH_007',
  AUTH_2FA_INVALID = 'AUTH_008',
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_009',
  AUTH_ACCOUNT_LOCKED = 'AUTH_010',

  // Authorization errors (1100-1199)
  AUTHZ_PERMISSION_DENIED = 'AUTHZ_001',
  AUTHZ_ROLE_INSUFFICIENT = 'AUTHZ_002',
  AUTHZ_RESOURCE_ACCESS_DENIED = 'AUTHZ_003',

  // Validation errors (2000-2099)
  VALIDATION_FAILED = 'VAL_001',
  VALIDATION_REQUIRED_FIELD = 'VAL_002',
  VALIDATION_INVALID_FORMAT = 'VAL_003',
  VALIDATION_INVALID_TYPE = 'VAL_004',
  VALIDATION_OUT_OF_RANGE = 'VAL_005',
  VALIDATION_DUPLICATE_VALUE = 'VAL_006',
  VALIDATION_INVALID_ENUM = 'VAL_007',

  // Resource errors (3000-3099)
  RESOURCE_NOT_FOUND = 'RES_001',
  RESOURCE_ALREADY_EXISTS = 'RES_002',
  RESOURCE_CONFLICT = 'RES_003',
  RESOURCE_LOCKED = 'RES_004',
  RESOURCE_DELETED = 'RES_005',

  // Business logic errors (4000-4099)
  BUSINESS_INSUFFICIENT_BALANCE = 'BUS_001',
  BUSINESS_TRANSACTION_LIMIT_EXCEEDED = 'BUS_002',
  BUSINESS_CARD_LIMIT_REACHED = 'BUS_003',
  BUSINESS_KYC_REQUIRED = 'BUS_004',
  BUSINESS_KYC_PENDING = 'BUS_005',
  BUSINESS_KYC_REJECTED = 'BUS_006',
  BUSINESS_TIER_RESTRICTION = 'BUS_007',
  BUSINESS_OPERATION_NOT_ALLOWED = 'BUS_008',

  // Rate limiting errors (5000-5099)
  RATE_LIMIT_EXCEEDED = 'RATE_001',
  RATE_LIMIT_GLOBAL_EXCEEDED = 'RATE_002',
  RATE_LIMIT_USER_EXCEEDED = 'RATE_003',

  // External service errors (6000-6099)
  EXTERNAL_SERVICE_ERROR = 'EXT_001',
  EXTERNAL_SERVICE_TIMEOUT = 'EXT_002',
  EXTERNAL_SERVICE_UNAVAILABLE = 'EXT_003',
  EXTERNAL_PAYMENT_FAILED = 'EXT_004',
  EXTERNAL_KYC_FAILED = 'EXT_005',
  EXTERNAL_EMAIL_FAILED = 'EXT_006',

  // Database errors (7000-7099)
  DATABASE_ERROR = 'DB_001',
  DATABASE_CONNECTION_ERROR = 'DB_002',
  DATABASE_TRANSACTION_ERROR = 'DB_003',
  DATABASE_CONSTRAINT_ERROR = 'DB_004',
  DATABASE_TIMEOUT = 'DB_005',

  // System errors (8000-8099)
  SYSTEM_ERROR = 'SYS_001',
  SYSTEM_MAINTENANCE = 'SYS_002',
  SYSTEM_OVERLOAD = 'SYS_003',
  SYSTEM_CONFIGURATION_ERROR = 'SYS_004',

  // Security errors (9000-9099)
  SECURITY_CSRF_INVALID = 'SEC_001',
  SECURITY_SIGNATURE_INVALID = 'SEC_002',
  SECURITY_SUSPICIOUS_ACTIVITY = 'SEC_003',
  SECURITY_IP_BLOCKED = 'SEC_004',
  SECURITY_CAPTCHA_FAILED = 'SEC_005'
}

/**
 * Error message mappings
 * Maps error codes to user-friendly messages
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // Authentication
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Authentication token has expired',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid authentication token',
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: 'Invalid refresh token',
  [ErrorCode.AUTH_SESSION_EXPIRED]: 'Session has expired',
  [ErrorCode.AUTH_UNAUTHORIZED]: 'Unauthorized access',
  [ErrorCode.AUTH_2FA_REQUIRED]: 'Two-factor authentication required',
  [ErrorCode.AUTH_2FA_INVALID]: 'Invalid two-factor authentication code',
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 'Email verification required',
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 'Account has been locked',

  // Authorization
  [ErrorCode.AUTHZ_PERMISSION_DENIED]: 'Permission denied',
  [ErrorCode.AUTHZ_ROLE_INSUFFICIENT]: 'Insufficient role privileges',
  [ErrorCode.AUTHZ_RESOURCE_ACCESS_DENIED]: 'Access to this resource is denied',

  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Validation failed',
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: 'Required field missing',
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 'Invalid format',
  [ErrorCode.VALIDATION_INVALID_TYPE]: 'Invalid data type',
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: 'Value out of range',
  [ErrorCode.VALIDATION_DUPLICATE_VALUE]: 'Duplicate value not allowed',
  [ErrorCode.VALIDATION_INVALID_ENUM]: 'Invalid enum value',

  // Resource
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found',
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'Resource already exists',
  [ErrorCode.RESOURCE_CONFLICT]: 'Resource conflict',
  [ErrorCode.RESOURCE_LOCKED]: 'Resource is locked',
  [ErrorCode.RESOURCE_DELETED]: 'Resource has been deleted',

  // Business logic
  [ErrorCode.BUSINESS_INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [ErrorCode.BUSINESS_TRANSACTION_LIMIT_EXCEEDED]: 'Transaction limit exceeded',
  [ErrorCode.BUSINESS_CARD_LIMIT_REACHED]: 'Card limit reached',
  [ErrorCode.BUSINESS_KYC_REQUIRED]: 'KYC verification required',
  [ErrorCode.BUSINESS_KYC_PENDING]: 'KYC verification pending',
  [ErrorCode.BUSINESS_KYC_REJECTED]: 'KYC verification rejected',
  [ErrorCode.BUSINESS_TIER_RESTRICTION]: 'Operation restricted for current tier',
  [ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED]: 'Operation not allowed',

  // Rate limiting
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests',
  [ErrorCode.RATE_LIMIT_GLOBAL_EXCEEDED]: 'Global rate limit exceeded',
  [ErrorCode.RATE_LIMIT_USER_EXCEEDED]: 'User rate limit exceeded',

  // External services
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
  [ErrorCode.EXTERNAL_SERVICE_TIMEOUT]: 'External service timeout',
  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: 'External service unavailable',
  [ErrorCode.EXTERNAL_PAYMENT_FAILED]: 'Payment processing failed',
  [ErrorCode.EXTERNAL_KYC_FAILED]: 'KYC verification failed',
  [ErrorCode.EXTERNAL_EMAIL_FAILED]: 'Email delivery failed',

  // Database
  [ErrorCode.DATABASE_ERROR]: 'Database error occurred',
  [ErrorCode.DATABASE_CONNECTION_ERROR]: 'Database connection error',
  [ErrorCode.DATABASE_TRANSACTION_ERROR]: 'Database transaction error',
  [ErrorCode.DATABASE_CONSTRAINT_ERROR]: 'Database constraint violation',
  [ErrorCode.DATABASE_TIMEOUT]: 'Database operation timeout',

  // System
  [ErrorCode.SYSTEM_ERROR]: 'System error occurred',
  [ErrorCode.SYSTEM_MAINTENANCE]: 'System under maintenance',
  [ErrorCode.SYSTEM_OVERLOAD]: 'System overloaded',
  [ErrorCode.SYSTEM_CONFIGURATION_ERROR]: 'System configuration error',

  // Security
  [ErrorCode.SECURITY_CSRF_INVALID]: 'CSRF validation failed',
  [ErrorCode.SECURITY_SIGNATURE_INVALID]: 'Invalid request signature',
  [ErrorCode.SECURITY_SUSPICIOUS_ACTIVITY]: 'Suspicious activity detected',
  [ErrorCode.SECURITY_IP_BLOCKED]: 'IP address blocked',
  [ErrorCode.SECURITY_CAPTCHA_FAILED]: 'Captcha verification failed'
};

/**
 * HTTP status code mappings
 * Maps error codes to appropriate HTTP status codes
 */
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  // Authentication - 401
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.AUTH_TOKEN_INVALID]: 401,
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: 401,
  [ErrorCode.AUTH_SESSION_EXPIRED]: 401,
  [ErrorCode.AUTH_UNAUTHORIZED]: 401,
  [ErrorCode.AUTH_2FA_REQUIRED]: 401,
  [ErrorCode.AUTH_2FA_INVALID]: 401,
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 401,
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 403,

  // Authorization - 403
  [ErrorCode.AUTHZ_PERMISSION_DENIED]: 403,
  [ErrorCode.AUTHZ_ROLE_INSUFFICIENT]: 403,
  [ErrorCode.AUTHZ_RESOURCE_ACCESS_DENIED]: 403,

  // Validation - 400
  [ErrorCode.VALIDATION_FAILED]: 400,
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: 400,
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 400,
  [ErrorCode.VALIDATION_INVALID_TYPE]: 400,
  [ErrorCode.VALIDATION_OUT_OF_RANGE]: 400,
  [ErrorCode.VALIDATION_DUPLICATE_VALUE]: 409,
  [ErrorCode.VALIDATION_INVALID_ENUM]: 400,

  // Resource - 404/409
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RESOURCE_LOCKED]: 423,
  [ErrorCode.RESOURCE_DELETED]: 410,

  // Business logic - 400/403
  [ErrorCode.BUSINESS_INSUFFICIENT_BALANCE]: 400,
  [ErrorCode.BUSINESS_TRANSACTION_LIMIT_EXCEEDED]: 400,
  [ErrorCode.BUSINESS_CARD_LIMIT_REACHED]: 400,
  [ErrorCode.BUSINESS_KYC_REQUIRED]: 403,
  [ErrorCode.BUSINESS_KYC_PENDING]: 403,
  [ErrorCode.BUSINESS_KYC_REJECTED]: 403,
  [ErrorCode.BUSINESS_TIER_RESTRICTION]: 403,
  [ErrorCode.BUSINESS_OPERATION_NOT_ALLOWED]: 403,

  // Rate limiting - 429
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.RATE_LIMIT_GLOBAL_EXCEEDED]: 429,
  [ErrorCode.RATE_LIMIT_USER_EXCEEDED]: 429,

  // External services - 502/503
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.EXTERNAL_SERVICE_TIMEOUT]: 504,
  [ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.EXTERNAL_PAYMENT_FAILED]: 502,
  [ErrorCode.EXTERNAL_KYC_FAILED]: 502,
  [ErrorCode.EXTERNAL_EMAIL_FAILED]: 502,

  // Database - 500
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.DATABASE_CONNECTION_ERROR]: 503,
  [ErrorCode.DATABASE_TRANSACTION_ERROR]: 500,
  [ErrorCode.DATABASE_CONSTRAINT_ERROR]: 409,
  [ErrorCode.DATABASE_TIMEOUT]: 504,

  // System - 500/503
  [ErrorCode.SYSTEM_ERROR]: 500,
  [ErrorCode.SYSTEM_MAINTENANCE]: 503,
  [ErrorCode.SYSTEM_OVERLOAD]: 503,
  [ErrorCode.SYSTEM_CONFIGURATION_ERROR]: 500,

  // Security - 403
  [ErrorCode.SECURITY_CSRF_INVALID]: 403,
  [ErrorCode.SECURITY_SIGNATURE_INVALID]: 403,
  [ErrorCode.SECURITY_SUSPICIOUS_ACTIVITY]: 403,
  [ErrorCode.SECURITY_IP_BLOCKED]: 403,
  [ErrorCode.SECURITY_CAPTCHA_FAILED]: 403
};

/**
 * Get error message by code
 */
export function getErrorMessage(code: ErrorCode): string {
  return ErrorMessages[code] || 'An error occurred';
}

/**
 * Get HTTP status code by error code
 */
export function getErrorStatusCode(code: ErrorCode): number {
  return ErrorStatusCodes[code] || 500;
}