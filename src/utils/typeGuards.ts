/**
 * Runtime type guards for type-safe validation
 * These guards complement Zod validation and provide runtime type checking
 */

/**
 * Basic type guards
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Advanced type guards
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isValidDateString(value: unknown): value is string {
  if (!isString(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

export function isUUID(value: unknown): value is string {
  if (!isString(value)) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export function isURL(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isJWT(value: unknown): value is string {
  if (!isString(value)) return false;
  const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  return jwtRegex.test(value);
}

/**
 * Array type guards
 */
export function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(itemGuard);
}

export function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString);
}

export function isNumberArray(value: unknown): value is number[] {
  return isArrayOf(value, isNumber);
}

export function isNonEmptyArray<T>(value: unknown): value is [T, ...T[]] {
  return isArray(value) && value.length > 0;
}

/**
 * Object shape guards
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function hasProperties<K extends string>(
  obj: unknown,
  ...keys: K[]
): obj is Record<K, unknown> {
  return isObject(obj) && keys.every(key => key in obj);
}

/**
 * API response guards
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function isSuccessResponse<T>(
  value: unknown
): value is SuccessResponse<T> {
  return (
    isObject(value) &&
    hasProperty(value, 'success') &&
    value['success'] === true &&
    hasProperty(value, 'data')
  );
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    isObject(value) &&
    hasProperty(value, 'success') &&
    value['success'] === false &&
    hasProperty(value, 'error') &&
    isObject(value['error']) &&
    hasProperties(value['error'], 'code', 'message') &&
    isString(value['error']['code']) &&
    isString(value['error']['message'])
  );
}

/**
 * External API response guards
 */
export function isSupabaseError(error: unknown): error is { code: string; message: string } {
  return (
    isObject(error) &&
    hasProperty(error, 'code') &&
    hasProperty(error, 'message') &&
    isString(error['code']) &&
    isString(error['message'])
  );
}

export function isAxiosError(error: unknown): error is {
  response?: {
    data?: unknown;
    status?: number;
    statusText?: string;
  };
  message: string;
} {
  return (
    isObject(error) &&
    hasProperty(error, 'message') &&
    isString(error['message']) &&
    (!hasProperty(error, 'response') || 
     (isObject(error['response']) && 
      (!hasProperty(error['response'], 'status') || isNumber(error['response']['status']))))
  );
}

/**
 * Business logic guards
 */
export function isValidAmount(value: unknown): value is number {
  return isNumber(value) && value > 0 && Number.isFinite(value);
}

export function isValidCurrency(value: unknown): value is string {
  if (!isString(value)) return false;
  const currencyRegex = /^[A-Z]{3}$/;
  return currencyRegex.test(value);
}

export function isValidStatus<T extends string>(
  value: unknown,
  validStatuses: readonly T[]
): value is T {
  return isString(value) && (validStatuses as readonly string[]).includes(value);
}

/**
 * Pagination guards
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export function isPaginationParams(value: unknown): value is PaginationParams {
  return (
    isObject(value) &&
    hasProperty(value, 'page') &&
    hasProperty(value, 'limit') &&
    isNumber(value['page']) &&
    isNumber(value['limit']) &&
    value['page'] > 0 &&
    value['limit'] > 0
  );
}

/**
 * User input guards
 */
export function isSafeString(value: unknown, maxLength: number = 1000): value is string {
  if (!isString(value)) return false;
  if (value.length > maxLength) return false;
  // Check for common injection patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /\/\*.*\*\//,
    /--/,
    /;.*drop/i,
    /;.*delete/i,
    /;.*update/i,
    /;.*insert/i
  ];
  return !dangerousPatterns.some(pattern => pattern.test(value));
}

/**
 * Type narrowing utilities
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

export function assertString(value: unknown, message?: string): asserts value is string {
  if (!isString(value)) {
    throw new Error(message || 'Value is not a string');
  }
}

export function assertNumber(value: unknown, message?: string): asserts value is number {
  if (!isNumber(value)) {
    throw new Error(message || 'Value is not a number');
  }
}

export function assertObject(value: unknown, message?: string): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(message || 'Value is not an object');
  }
}

/**
 * Utility function to create custom type guards
 */
export function createGuard<T>(
  predicate: (value: unknown) => boolean
): (value: unknown) => value is T {
  return (value: unknown): value is T => predicate(value);
}

/**
 * Combine multiple guards with AND logic
 */
export function combineGuards<T>(...guards: Array<(value: unknown) => value is T>): (value: unknown) => value is T {
  return (value: unknown): value is T => guards.every(guard => guard(value));
}

/**
 * Combine multiple guards with OR logic
 */
export function anyGuard<T>(...guards: Array<(value: unknown) => value is T>): (value: unknown) => value is T {
  return (value: unknown): value is T => guards.some(guard => guard(value));
}