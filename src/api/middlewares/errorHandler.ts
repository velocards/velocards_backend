import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors';
import logger from '../../utils/logger';
import { env } from '../../config/env';
import { 
  ErrorCode,
  getErrorMessage
} from '../../constants/errorCodes';
import { createErrorResponse } from './responseWrapper';
import { ZodError } from 'zod';

/**
 * Centralized error handler middleware
 * Provides consistent error formatting and prevents internal error exposure
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = (req as any).correlationId || (req as any).id;
  
  // Log error with full details
  logger.error('Error handler caught error', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...('code' in err && { code: (err as any).code }),
      ...('statusCode' in err && { statusCode: (err as any).statusCode })
    },
    request: {
      method: req.method,
      url: req.url,
      path: req.path,
      ip: req.ip,
      userId: (req as any).user?.id,
      correlationId
    }
  });

  // Handle AppError (our custom error class)
  if (err instanceof AppError) {
    const errorCode = (err as any).errorCode || ErrorCode.SYSTEM_ERROR;
    const response = createErrorResponse(
      err.message,
      err.code || errorCode,
      err.statusCode,
      env.NODE_ENV !== 'production' ? err.details : undefined
    );
    
    res.status(err.statusCode).json({
      ...response,
      ...(req.path.startsWith('/api/v2') && {
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      })
    });
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const issues = err.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message
    }));
    
    const response = createErrorResponse(
      'Validation failed',
      ErrorCode.VALIDATION_FAILED,
      400,
      env.NODE_ENV !== 'production' ? { issues } : undefined
    );
    
    res.status(400).json({
      ...response,
      ...(req.path.startsWith('/api/v2') && {
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      })
    });
    return;
  }

  // Handle Joi validation errors (if Joi is still used)
  if (err.name === 'ValidationError' && 'details' in err) {
    const joiError = err as any;
    const details = joiError.details?.map((detail: any) => ({
      path: detail.path?.join('.'),
      message: detail.message
    }));
    
    const response = createErrorResponse(
      'Validation failed',
      ErrorCode.VALIDATION_FAILED,
      400,
      env.NODE_ENV !== 'production' ? { details } : undefined
    );
    
    res.status(400).json({
      ...response,
      ...(req.path.startsWith('/api/v2') && {
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      })
    });
    return;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    const jsonError = err as SyntaxError & { status?: number; body?: string };
    
    logger.warn('JSON parse error', {
      message: err.message,
      body: jsonError.body?.substring(0, 200),
      endpoint: req.url,
      method: req.method,
      correlationId
    });
    
    const response = createErrorResponse(
      'Invalid JSON in request body',
      ErrorCode.VALIDATION_INVALID_FORMAT,
      400
    );
    
    res.status(400).json({
      ...response,
      ...(req.path.startsWith('/api/v2') && {
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      })
    });
    return;
  }

  // Handle database errors
  if (err.message && err.message.toLowerCase().includes('database')) {
    const response = createErrorResponse(
      getErrorMessage(ErrorCode.DATABASE_ERROR),
      ErrorCode.DATABASE_ERROR,
      500
    );
    
    res.status(500).json({
      ...response,
      ...(req.path.startsWith('/api/v2') && {
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      })
    });
    return;
  }

  // Handle rate limit errors
  if (err.message && err.message.toLowerCase().includes('rate limit')) {
    const response = createErrorResponse(
      getErrorMessage(ErrorCode.RATE_LIMIT_EXCEEDED),
      ErrorCode.RATE_LIMIT_EXCEEDED,
      429
    );
    
    res.status(429).json({
      ...response,
      ...(req.path.startsWith('/api/v2') && {
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      })
    });
    return;
  }

  // Handle authentication errors
  if (err.name === 'UnauthorizedError' || err.message.toLowerCase().includes('unauthorized')) {
    const response = createErrorResponse(
      getErrorMessage(ErrorCode.AUTH_UNAUTHORIZED),
      ErrorCode.AUTH_UNAUTHORIZED,
      401
    );
    
    res.status(401).json({
      ...response,
      ...(req.path.startsWith('/api/v2') && {
        timestamp: new Date().toISOString(),
        correlationId,
        version: 'v2'
      })
    });
    return;
  }

  // Handle unknown errors (default case)
  const response = createErrorResponse(
    env.NODE_ENV === 'production' 
      ? getErrorMessage(ErrorCode.SYSTEM_ERROR)
      : err.message,
    ErrorCode.SYSTEM_ERROR,
    500,
    env.NODE_ENV !== 'production' ? { stack: err.stack } : undefined
  );
  
  res.status(500).json({
    ...response,
    ...(req.path.startsWith('/api/v2') && {
      timestamp: new Date().toISOString(),
      correlationId,
      version: 'v2'
    })
  });
}