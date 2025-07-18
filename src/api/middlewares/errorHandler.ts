import { Request, Response, NextFunction } from 'express';
  import { AppError } from '../../utils/errors';
  import logger from '../../utils/logger';
  import { env } from '../../config/env';

  export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
  ): void {
    // Log error
    logger.error(`${err.name}: ${err.message}`, {
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name
      },
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userId: (req as any).user?.id
      }
    });

    // Handle known errors
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          ...(err.details && { details: err.details })
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).id
        }
      });
      return;
    }

    // Handle JSON parse errors
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).id
        }
      });
      return;
    }

    // Handle unknown errors
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
        ...(env.NODE_ENV !== 'production' && { stack: err.stack })
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as any).id
      }
    });
  }