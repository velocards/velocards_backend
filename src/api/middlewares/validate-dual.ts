import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import Joi from 'joi';
import { ValidationError } from '../../utils/errors';
import { features } from '../../config/env';

// Feature flag for validator selection
const USE_ZOD = features.useZodValidator; // Default to true (Zod)

/**
 * Dual validation middleware that supports both Joi and Zod validators
 * Controlled by USE_ZOD_VALIDATOR environment variable
 */
export function validateDual(zodSchema: ZodSchema, joiSchema?: Joi.Schema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = {
        body: req.body,
        query: req.query,
        params: req.params
      };

      if (USE_ZOD || !joiSchema) {
        // Use Zod validator (default)
        await zodSchema.parseAsync(data);
      } else {
        // Use Joi validator
        const result = joiSchema.validate(data, {
          abortEarly: false,
          stripUnknown: false,
          convert: true
        });

        if (result.error) {
          // Convert Joi errors to match Zod error format
          const errors = result.error.details.map(detail => ({
            path: detail.path,
            message: detail.message,
            type: detail.type
          }));
          throw new ValidationError(errors);
        }

        // Update request with converted values
        if (result.value) {
          if (result.value.body) req.body = result.value.body;
          if (result.value.query) req.query = result.value.query;
          if (result.value.params) req.params = result.value.params;
        }
      }

      next();
    } catch (error: any) {
      if (error instanceof ValidationError) {
        next(error);
      } else {
        // Handle Zod errors
        next(new ValidationError(error.errors || error));
      }
    }
  };
}

/**
 * Original validate function for backward compatibility
 * Always uses Zod
 */
export function validate(schema: ZodSchema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error: any) {
      next(new ValidationError(error.errors));
    }
  };
}

/**
 * Joi-only validation middleware
 * For testing Joi schemas independently
 */
export function validateJoi(schema: Joi.Schema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = {
        body: req.body,
        query: req.query,
        params: req.params
      };

      const result = schema.validate(data, {
        abortEarly: false,
        stripUnknown: false,
        convert: true
      });

      if (result.error) {
        const errors = result.error.details.map(detail => ({
          path: detail.path,
          message: detail.message,
          type: detail.type
        }));
        throw new ValidationError(errors);
      }

      // Update request with converted values
      if (result.value) {
        if (result.value.body) req.body = result.value.body;
        if (result.value.query) req.query = result.value.query;
        if (result.value.params) req.params = result.value.params;
      }

      next();
    } catch (error: any) {
      if (error instanceof ValidationError) {
        next(error);
      } else {
        next(new ValidationError([{ path: [], message: error.message }]));
      }
    }
  };
}

/**
 * Parallel validation middleware for testing parity
 * Runs both validators and logs any discrepancies
 */
export function validateParallel(zodSchema: ZodSchema, joiSchema: Joi.Schema) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const data = {
      body: req.body,
      query: req.query,
      params: req.params
    };

    let zodResult: { valid: boolean; error?: any } = { valid: false };
    let joiResult: { valid: boolean; error?: any } = { valid: false };

    // Run Zod validation
    try {
      await zodSchema.parseAsync(data);
      zodResult = { valid: true };
    } catch (error: any) {
      zodResult = { valid: false, error: error.errors };
    }

    // Run Joi validation
    const joiValidation = joiSchema.validate(data, {
      abortEarly: false,
      stripUnknown: false,
      convert: true
    });

    if (joiValidation.error) {
      joiResult = { valid: false, error: joiValidation.error.details };
    } else {
      joiResult = { valid: true };
    }

    // Log discrepancies if results differ
    if (zodResult.valid !== joiResult.valid) {
      console.warn('Validation parity mismatch detected!', {
        endpoint: req.path,
        method: req.method,
        zodValid: zodResult.valid,
        joiValid: joiResult.valid,
        zodErrors: zodResult.error,
        joiErrors: joiResult.error,
        data
      });
    }

    // Use the configured validator result
    if (USE_ZOD) {
      if (!zodResult.valid) {
        next(new ValidationError(zodResult.error));
      } else {
        next();
      }
    } else {
      if (!joiResult.valid) {
        const errors = joiResult.error.map((detail: any) => ({
          path: detail.path,
          message: detail.message,
          type: detail.type
        }));
        next(new ValidationError(errors));
      } else {
        // Update request with Joi converted values
        if (joiValidation.value) {
          if (joiValidation.value.body) req.body = joiValidation.value.body;
          if (joiValidation.value.query) req.query = joiValidation.value.query;
          if (joiValidation.value.params) req.params = joiValidation.value.params;
        }
        next();
      }
    }
  };
}

/**
 * Get current validator type
 */
export function getCurrentValidator(): 'zod' | 'joi' {
  return USE_ZOD ? 'zod' : 'joi';
}

/**
 * Middleware to add validator info to response headers
 */
export function validatorInfoMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Validator-Type', getCurrentValidator());
  next();
}