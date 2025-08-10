/**
 * Type-safe API response structures
 * Replaces 'any' types with proper generics and interfaces
 */

/**
 * Base response meta information
 */
export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
}

/**
 * Pagination meta information
 */
export interface PaginationMeta extends ResponseMeta {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Generic success response type
 * @template T The type of the response data
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: ResponseMeta | PaginationMeta;
}

/**
 * Error details type - can be string, object, or array
 */
export type ErrorDetails = string | Record<string, unknown> | unknown[];

/**
 * Error response type with typed error details
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
  meta: ResponseMeta;
}

/**
 * Union type for all API responses
 * @template T The type of the success response data
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse<T>(
  response: ApiResponse<T>
): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Paginated response type
 * @template T The type of items in the paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Common response data types
 */
export interface MessageResponse {
  message: string;
}

export interface IdResponse {
  id: string;
}

export interface StatusResponse {
  status: string;
}

export interface CountResponse {
  count: number;
}

/**
 * Batch operation response
 */
export interface BatchOperationResponse<T = unknown> {
  successful: T[];
  failed: Array<{
    item: T;
    error: string;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url?: string;
}

/**
 * Validation error response details
 */
export interface ValidationErrorDetails {
  field: string;
  message: string;
  value?: unknown;
  code?: string;
}

/**
 * Rate limit response headers
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services?: Record<string, {
    status: 'up' | 'down';
    latency?: number;
    error?: string;
  }>;
}

/**
 * Empty response for DELETE operations
 */
export type EmptyResponse = Record<string, never>;

/**
 * Token response for authentication
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Generic list response
 * @template T The type of items in the list
 */
export interface ListResponse<T> {
  items: T[];
  total: number;
}