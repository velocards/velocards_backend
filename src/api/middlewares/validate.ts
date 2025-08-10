import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../utils/errors';
import { performance } from 'perf_hooks';
import { validationMonitor } from '../../validation/zod/monitoring/performanceMonitor';

export function validate(schema: ZodSchema, schemaName?: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const startTime = performance.now();
    const monitoringName = schemaName || `${req.method}-${req.route?.path || req.path}`;
    
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      
      // Record successful validation
      if (process.env['ENABLE_VALIDATION_MONITORING'] === 'true') {
        validationMonitor.recordValidation(monitoringName, startTime, true);
      }
      
      next();
    } catch (error: any) {
      let formattedErrors: any;
      let errorCount = 0;
      
      if (error instanceof ZodError) {
        // Format Zod errors consistently
        formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        errorCount = error.errors.length;
      } else {
        formattedErrors = error.errors || error.message;
        errorCount = 1;
      }
      
      // Record failed validation
      if (process.env['ENABLE_VALIDATION_MONITORING'] === 'true') {
        validationMonitor.recordValidation(monitoringName, startTime, false, errorCount);
      }
      
      next(new ValidationError(formattedErrors));
    }
  };
}