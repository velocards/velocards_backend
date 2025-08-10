/**
 * Type-safe error handling types
 * Replaces catch(error: any) patterns with proper types
 */

/**
 * Base error interface for all application errors
 */
export interface BaseError {
  name: string;
  message: string;
  stack?: string;
}

/**
 * Application error with additional context
 */
export class AppError extends Error implements BaseError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error for request validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: unknown) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', details?: unknown) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', { resource, identifier });
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict error for resource conflicts
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number | undefined;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
    if (retryAfter !== undefined) {
      this.retryAfter = retryAfter;
    }
  }
}

/**
 * External service error for third-party API failures
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;
  public readonly originalError?: unknown;

  constructor(
    service: string,
    message: string,
    originalError?: unknown,
    statusCode: number = 503
  ) {
    super(
      message,
      statusCode,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalError }
    );
    this.name = 'ExternalServiceError';
    this.service = service;
    this.originalError = originalError;
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  public readonly query?: string | undefined;
  public readonly originalError?: unknown;

  constructor(message: string, query?: string, originalError?: unknown) {
    super(message, 500, 'DATABASE_ERROR', { query, originalError });
    this.name = 'DatabaseError';
    if (query !== undefined) {
      this.query = query;
    }
    this.originalError = originalError;
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if an error is a standard Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if error has a message property
 */
export function hasMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Type guard to check if error has a code property
 */
export function hasCode(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (hasMessage(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Safe error code extraction
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  if (hasCode(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  const message = getErrorMessage(error);
  const code = getErrorCode(error);
  
  return new AppError(message, 500, code, error);
}

/**
 * Error details for logging
 */
export interface ErrorLogDetails {
  name: string;
  message: string;
  code: string;
  statusCode?: number;
  stack?: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(
  error: unknown,
  requestId?: string
): ErrorLogDetails {
  const appError = toAppError(error);
  
  const result: ErrorLogDetails = {
    name: appError.name,
    message: appError.message,
    code: appError.code,
    timestamp: new Date().toISOString()
  };
  
  if (appError.statusCode !== undefined) result.statusCode = appError.statusCode;
  if (appError.stack !== undefined) result.stack = appError.stack;
  if (appError.details !== undefined) result.details = appError.details;
  if (requestId !== undefined) result.requestId = requestId;
  
  return result;
}