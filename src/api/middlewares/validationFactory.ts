import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../../utils/errors';
import { performance } from 'perf_hooks';
import { validationMonitor } from '../../validation/zod/monitoring/performanceMonitor';
import logger from '../../utils/logger';

interface ValidationOptions {
  /**
   * Name for monitoring and logging
   */
  schemaName?: string;
  
  /**
   * Whether to strip unknown properties from the input
   */
  stripUnknown?: boolean;
  
  /**
   * Whether to abort early on first validation error
   */
  abortEarly?: boolean;
  
  /**
   * Custom error transformer
   */
  errorTransformer?: (errors: ZodError) => any;
  
  /**
   * Whether to skip validation in certain environments
   */
  skipInEnvironments?: string[];
  
  /**
   * Whether to sanitize input before validation
   */
  sanitizeInput?: boolean;
  
  /**
   * Maximum request body size in bytes
   */
  maxBodySize?: number;
  
  /**
   * Whether to cache validation results
   */
  enableCache?: boolean;
}

/**
 * Validation middleware factory with enhanced features
 */
export class ValidationFactory {
  private static cache = new Map<string, any>();
  private static readonly DEFAULT_MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Create a validation middleware with options
   */
  static create(schema: ZodSchema, options: ValidationOptions = {}) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      const {
        schemaName = `${req.method}-${req.route?.path || req.path}`,
        abortEarly = false,
        errorTransformer,
        skipInEnvironments = [],
        sanitizeInput = true,
        maxBodySize = ValidationFactory.DEFAULT_MAX_BODY_SIZE,
        enableCache = false
      } = options;

      // Skip validation in specified environments
      if (skipInEnvironments.includes(process.env['NODE_ENV'] || '')) {
        return next();
      }

      // Check request body size
      if (req.body && JSON.stringify(req.body).length > maxBodySize) {
        return next(new ValidationError([{
          field: 'body',
          message: `Request body exceeds maximum size of ${maxBodySize} bytes`,
          code: 'BODY_TOO_LARGE'
        }]));
      }

      const startTime = performance.now();
      
      try {
        // Prepare input data
        let input = {
          body: req.body,
          query: req.query,
          params: req.params
        };

        // Sanitize input if enabled
        if (sanitizeInput) {
          input = ValidationFactory.sanitizeData(input);
        }

        // Check cache if enabled
        const cacheKey = enableCache ? ValidationFactory.getCacheKey(schemaName, input) : null;
        if (cacheKey && ValidationFactory.cache.has(cacheKey)) {
          const cachedResult = ValidationFactory.cache.get(cacheKey);
          Object.assign(req, cachedResult);
          
          // Record cached validation
          if (process.env['ENABLE_VALIDATION_MONITORING'] === 'true') {
            validationMonitor.recordValidation(schemaName, startTime, true);
          }
          
          return next();
        }

        // Parse with options
        const result = await schema.parseAsync(input);

        // Update request with validated data
        if (result.body) req.body = result.body;
        if (result.query) req.query = result.query;
        if (result.params) req.params = result.params;

        // Cache result if enabled
        if (cacheKey) {
          ValidationFactory.cache.set(cacheKey!, {
            body: result.body,
            query: result.query,
            params: result.params
          });
          
          // Limit cache size
          if (ValidationFactory.cache.size > 1000) {
            const firstKey = ValidationFactory.cache.keys().next().value;
            if (firstKey) ValidationFactory.cache.delete(firstKey);
          }
        }

        // Record successful validation
        if (process.env['ENABLE_VALIDATION_MONITORING'] === 'true') {
          validationMonitor.recordValidation(schemaName, startTime, true);
        }

        next();
      } catch (error: any) {
        let formattedErrors: any;
        let errorCount = 0;

        if (error instanceof ZodError) {
          if (errorTransformer) {
            formattedErrors = errorTransformer(error);
          } else {
            formattedErrors = ValidationFactory.formatZodErrors(error, abortEarly);
          }
          errorCount = error.errors.length;
        } else {
          formattedErrors = error.errors || error.message;
          errorCount = 1;
        }

        // Record failed validation
        if (process.env['ENABLE_VALIDATION_MONITORING'] === 'true') {
          validationMonitor.recordValidation(schemaName, startTime, false, errorCount);
        }

        // Log validation errors in development
        if (process.env['NODE_ENV'] === 'development') {
          logger.debug('Validation failed', {
            schemaName,
            errors: formattedErrors,
            input: { body: req.body, query: req.query, params: req.params }
          });
        }

        next(new ValidationError(formattedErrors));
      }
    };
  }

  /**
   * Create a validation middleware for body only
   */
  static body(schema: ZodSchema, options?: ValidationOptions) {
    const bodyOnlySchema = schema.transform((data: any) => ({
      body: data,
      query: {},
      params: {}
    }));
    
    return ValidationFactory.create(bodyOnlySchema, options);
  }

  /**
   * Create a validation middleware for query only
   */
  static query(schema: ZodSchema, options?: ValidationOptions) {
    const queryOnlySchema = schema.transform((data: any) => ({
      body: {},
      query: data,
      params: {}
    }));
    
    return ValidationFactory.create(queryOnlySchema, options);
  }

  /**
   * Create a validation middleware for params only
   */
  static params(schema: ZodSchema, options?: ValidationOptions) {
    const paramsOnlySchema = schema.transform((data: any) => ({
      body: {},
      query: {},
      params: data
    }));
    
    return ValidationFactory.create(paramsOnlySchema, options);
  }

  /**
   * Create a conditional validation middleware
   */
  static conditional(
    condition: (req: Request) => boolean,
    schema: ZodSchema,
    options?: ValidationOptions
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (condition(req)) {
        return ValidationFactory.create(schema, options)(req, res, next);
      }
      return next();
    };
  }

  /**
   * Create a validation bypass for internal service calls
   */
  static bypassInternal(schema: ZodSchema, options?: ValidationOptions) {
    return ValidationFactory.conditional(
      (req) => req.headers['x-internal-service'] !== 'true',
      schema,
      options
    );
  }

  /**
   * Format Zod errors consistently
   */
  private static formatZodErrors(error: ZodError, abortEarly: boolean) {
    const errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }));

    return abortEarly ? [errors[0]] : errors;
  }

  /**
   * Sanitize input data
   */
  private static sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Remove null bytes and control characters
      return data
        .replace(/\0/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .trim();
    }
    
    if (Array.isArray(data)) {
      return data.map(item => ValidationFactory.sanitizeData(item));
    }
    
    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = ValidationFactory.sanitizeData(value);
      }
      return sanitized;
    }
    
    return data;
  }

  /**
   * Generate cache key for validation
   */
  private static getCacheKey(schemaName: string, input: any): string {
    return `${schemaName}:${JSON.stringify(input)}`;
  }

  /**
   * Clear validation cache
   */
  static clearCache() {
    ValidationFactory.cache.clear();
  }
}

// Export convenience functions
export const createValidator = ValidationFactory.create;
export const bodyValidator = ValidationFactory.body;
export const queryValidator = ValidationFactory.query;
export const paramsValidator = ValidationFactory.params;
export const conditionalValidator = ValidationFactory.conditional;
export const bypassInternalValidator = ValidationFactory.bypassInternal;