import { Response } from 'express';
import { 
  ApiSuccessResponse, 
  ApiErrorResponse, 
  ErrorDetails 
} from '@/types/apiResponses';

// Re-export types for backward compatibility
type SuccessResponse<T = unknown> = ApiSuccessResponse<T>;
type ErrorResponse = ApiErrorResponse;

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: Partial<SuccessResponse['meta']>
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
  
  return res.status(statusCode).json(response);
}

export function formatResponse<T>(data: T, meta?: Partial<SuccessResponse['meta']>): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 400,
  details?: ErrorDetails
): Response {
  const requestId = (res.req as Express.Request & { id?: string }).id;
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details })
    },
    meta: {
      timestamp: new Date().toISOString(),
      ...(requestId !== undefined && { requestId })
    }
  };
  
  return res.status(statusCode).json(response);
}

export function sendPaginatedSuccess<T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  statusCode: number = 200
): Response {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  
  return sendSuccess(res, data, statusCode, {
    pagination: {
      ...pagination,
      totalPages
    }
  });
}

// Additional helper functions for better compatibility
export function formatSuccessResponse<T>(
  data: T,
  meta?: Partial<SuccessResponse['meta']>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

export function formatErrorResponse(
  code: string,
  message: string,
  details?: ErrorDetails
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details })
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}