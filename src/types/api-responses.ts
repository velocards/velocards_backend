/**
 * Standard API Response Types
 * Defines TypeScript types for consistent API responses across all endpoints
 */

/**
 * Base response interface for all API responses
 * Maintains backward compatibility with v1 format
 */
export interface BaseApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Extended response interface for v2 API with additional metadata
 */
export interface ApiResponseV2<T = any> extends BaseApiResponse<T> {
  timestamp?: string;
  correlationId?: string;
  version?: string;
}

/**
 * Error response with detailed error information
 */
export interface ErrorResponse extends BaseApiResponse {
  success: false;
  error: string;
  errorCode?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

/**
 * Success response wrapper
 */
export interface SuccessResponse<T = any> extends BaseApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Paginated response wrapper
 * Compatible with existing pagination format
 */
export interface PaginatedResponse<T = any> extends SuccessResponse<{
  items: T[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit?: number;
  };
}> {}

/**
 * Cursor-based pagination response
 * Compatible with Story 3.2.4 cursor pagination implementation
 */
export interface CursorPaginatedResponse<T = any> extends SuccessResponse<{
  edges: Array<{
    node: T;
    cursor: string;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
    totalCount?: number;
  };
}> {}

/**
 * Batch operation response
 */
export interface BatchResponse<T = any> extends SuccessResponse<{
  successful: T[];
  failed: Array<{
    item: any;
    error: string;
    errorCode?: string;
  }>;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
}> {}

/**
 * API version info response
 */
export interface ApiVersionResponse extends SuccessResponse<{
  version: string;
  supportedVersions: string[];
  deprecationWarnings?: Array<{
    feature: string;
    deprecatedIn: string;
    removeIn: string;
    alternative: string;
  }>;
}> {}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: BaseApiResponse): response is ErrorResponse {
  return response.success === false;
}

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(response: BaseApiResponse<T>): response is SuccessResponse<T> {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if response is paginated
 */
export function isPaginatedResponse<T>(response: BaseApiResponse): response is PaginatedResponse<T> {
  return (
    response.success === true &&
    response.data !== undefined &&
    'items' in response.data &&
    'pagination' in response.data
  );
}

/**
 * Type guard to check if response is cursor paginated
 */
export function isCursorPaginatedResponse<T>(response: BaseApiResponse): response is CursorPaginatedResponse<T> {
  return (
    response.success === true &&
    response.data !== undefined &&
    'edges' in response.data &&
    'pageInfo' in response.data
  );
}