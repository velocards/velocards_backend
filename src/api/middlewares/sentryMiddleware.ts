import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

// Sentry middleware for Express
export function sentryRequestHandler() {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Start a new Sentry scope for this request
    Sentry.withScope((scope) => {
      // Add request data to scope
      scope.setContext('request', {
        url: req.url,
        method: req.method,
        headers: req.headers,
        query: req.query,
      });
      
      // Add user context if authenticated
      if ((req as any).user) {
        scope.setUser({
          id: (req as any).user.id,
          email: (req as any).user.email,
        });
      }
      
      next();
    });
  };
}

// Sentry error handler
export function sentryErrorHandler() {
  return (err: Error, req: Request, _res: Response, next: NextFunction) => {
    // Capture exception with Sentry
    Sentry.captureException(err);
    
    // Add extra context
    Sentry.withScope((scope) => {
      scope.setContext('request', {
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body,
      });
      
      if ((req as any).user) {
        scope.setUser({
          id: (req as any).user.id,
          email: (req as any).user.email,
        });
      }
    });
    
    // Pass to next error handler
    next(err);
  };
}