import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { 
  SuccessResponse, 
  ErrorResponse, 
  PaginatedResponse,
  CursorPaginatedResponse,
  ApiResponseV2 
} from '../../types/api-responses';
import logger from '../../utils/logger';

/**
 * Response wrapper middleware
 * Provides consistent response format across all API endpoints
 */

interface ExtendedResponse extends Response {
  sendSuccess: <T>(data: T, statusCode?: number) => void;
  sendError: (error: string | Error, statusCode?: number, errorCode?: string) => void;
  sendPaginated: <T>(items: T[], pagination: { total: number; page: number; pages: number; limit?: number }, statusCode?: number) => void;
  sendCursorPaginated: <T>(edges: Array<{ node: T; cursor: string }>, pageInfo: any, statusCode?: number) => void;
}

/**
 * Create success response helper
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data
  };
}

/**
 * Create error response helper
 */
export function createErrorResponse(
  error: string | Error,
  errorCode?: string,
  statusCode?: number,
  details?: Record<string, any>
): any {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Never expose internal error details in production
  const safeErrorMessage = process.env['NODE_ENV'] === 'production' 
    ? getPublicErrorMessage(errorMessage, errorCode)
    : errorMessage;

  return {
    success: false,
    error: safeErrorMessage,
    errorCode,
    statusCode,
    details: process.env['NODE_ENV'] !== 'production' ? details : undefined
  };
}

/**
 * Create paginated response helper
 */
export function createPaginatedResponse<T>(
  items: T[],
  pagination: { total: number; page: number; pages: number; limit?: number }
): PaginatedResponse<T> {
  return {
    success: true,
    data: {
      items,
      pagination
    }
  };
}

/**
 * Create cursor paginated response helper
 */
export function createCursorPaginatedResponse<T>(
  edges: Array<{ node: T; cursor: string }>,
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
    totalCount?: number;
  }
): CursorPaginatedResponse<T> {
  return {
    success: true,
    data: {
      edges,
      pageInfo
    }
  };
}

/**
 * Get public-safe error message
 */
function getPublicErrorMessage(errorMessage: string, errorCode?: string): string {
  // Map internal errors to safe public messages
  const errorMappings: Record<string, string> = {
    'ECONNREFUSED': 'Service temporarily unavailable',
    'ENOTFOUND': 'Service temporarily unavailable',
    'ETIMEDOUT': 'Request timeout',
    'Invalid credentials': 'Invalid credentials',
    'Unauthorized': 'Unauthorized access',
    'Forbidden': 'Access forbidden',
    'Not found': 'Resource not found',
    'Validation error': 'Invalid request data',
    'Rate limit exceeded': 'Too many requests',
    'Database error': 'An error occurred processing your request',
    'Internal server error': 'An error occurred processing your request'
  };

  // Check for known error patterns
  for (const [pattern, publicMessage] of Object.entries(errorMappings)) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return publicMessage;
    }
  }

  // Default safe message for unknown errors
  return errorCode ? `Operation failed (${errorCode})` : 'An error occurred processing your request';
}

/**
 * Response wrapper middleware
 * Adds helper methods to response object for consistent formatting
 */
export function responseWrapper(req: Request, res: Response, next: NextFunction): void {
  const extendedRes = res as ExtendedResponse;
  const correlationId = (req as any).correlationId || uuidv4();

  // Add success response helper
  extendedRes.sendSuccess = function<T>(data: T, statusCode: number = 200): void {
    const response = createSuccessResponse(data);
    
    // Add v2 metadata if API version is v2
    if (req.path.startsWith('/api/v2')) {
      const v2Response: ApiResponseV2<T> = {
        ...response,
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      };
      this.status(statusCode).json(v2Response);
    } else {
      this.status(statusCode).json(response);
    }

    // Log successful response
    logger.info('API response sent', {
      correlationId,
      statusCode,
      path: req.path,
      method: req.method,
      success: true
    });
  };

  // Add error response helper
  extendedRes.sendError = function(
    error: string | Error,
    statusCode: number = 500,
    errorCode?: string
  ): void {
    const response = createErrorResponse(error, errorCode, statusCode);
    
    // Add v2 metadata if API version is v2
    if (req.path.startsWith('/api/v2')) {
      const v2Response: ApiResponseV2 = {
        ...response,
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      };
      this.status(statusCode).json(v2Response);
    } else {
      this.status(statusCode).json(response);
    }

    // Log error response
    logger.error('API error response sent', {
      correlationId,
      statusCode,
      path: req.path,
      method: req.method,
      error: error instanceof Error ? error.message : error,
      errorCode,
      stack: error instanceof Error ? error.stack : undefined
    });
  };

  // Add paginated response helper
  extendedRes.sendPaginated = function<T>(
    items: T[],
    pagination: { total: number; page: number; pages: number; limit?: number },
    statusCode: number = 200
  ): void {
    const response = createPaginatedResponse(items, pagination);
    
    // Add v2 metadata if API version is v2
    if (req.path.startsWith('/api/v2')) {
      const v2Response: ApiResponseV2 = {
        ...response,
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      };
      this.status(statusCode).json(v2Response);
    } else {
      this.status(statusCode).json(response);
    }

    // Log paginated response
    logger.info('API paginated response sent', {
      correlationId,
      statusCode,
      path: req.path,
      method: req.method,
      itemCount: items.length,
      pagination
    });
  };

  // Add cursor paginated response helper
  extendedRes.sendCursorPaginated = function<T>(
    edges: Array<{ node: T; cursor: string }>,
    pageInfo: any,
    statusCode: number = 200
  ): void {
    const response = createCursorPaginatedResponse(edges, pageInfo);
    
    // Add v2 metadata if API version is v2
    if (req.path.startsWith('/api/v2')) {
      const v2Response: ApiResponseV2 = {
        ...response,
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      };
      this.status(statusCode).json(v2Response);
    } else {
      this.status(statusCode).json(response);
    }

    // Log cursor paginated response
    logger.info('API cursor paginated response sent', {
      correlationId,
      statusCode,
      path: req.path,
      method: req.method,
      edgeCount: edges.length,
      pageInfo
    });
  };

  next();
}

// Export extended response type for use in controllers
export type { ExtendedResponse };