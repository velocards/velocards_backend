import { Request, Response, NextFunction } from 'express';
import validator from 'validator';
import xss from 'xss';
import logger from '../../utils/logger';

// Fields that should not be sanitized
const EXCLUDED_FIELDS = new Set([
  'password',
  'confirmPassword',
  'currentPassword',
  'newPassword',
  'token',
  'refreshToken',
  'accessToken',
  'apiKey',
  'secret',
  'pan',
  'cvv',
  'cardNumber'
]);

// Fields that require special handling
const EMAIL_FIELDS = new Set(['email', 'userEmail', 'contactEmail']);
const URL_FIELDS = new Set(['url', 'website', 'webhookUrl', 'redirectUrl']);
const PHONE_FIELDS = new Set(['phone', 'phoneNumber', 'mobile']);

/**
 * Sanitize a single value based on its type and field name
 */
function sanitizeValue(value: any, fieldName: string): any {
  // Skip non-string values
  if (typeof value !== 'string') {
    return value;
  }

  // Skip excluded fields
  if (EXCLUDED_FIELDS.has(fieldName)) {
    return value;
  }

  // Trim whitespace
  let sanitized = value.trim();

  // Apply XSS sanitization
  sanitized = xss(sanitized, {
    whiteList: {}, // No HTML tags allowed by default
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });

  // Special handling for specific field types
  if (EMAIL_FIELDS.has(fieldName)) {
    sanitized = validator.normalizeEmail(sanitized) || sanitized;
  } else if (URL_FIELDS.has(fieldName)) {
    // Only keep valid URLs
    if (!validator.isURL(sanitized, { require_protocol: true })) {
      logger.warn('Invalid URL detected during sanitization', { fieldName, value: sanitized });
      return '';
    }
  } else if (PHONE_FIELDS.has(fieldName)) {
    // Remove non-numeric characters except + for international format
    sanitized = sanitized.replace(/[^\d+]/g, '');
  }

  // Escape HTML entities for additional safety
  sanitized = validator.escape(sanitized);

  return sanitized;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any, path: string = ''): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`));
  }

  if (typeof obj === 'object' && obj.constructor === Object) {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;
      sanitized[key] = sanitizeObject(value, fieldPath);
    }
    
    return sanitized;
  }

  // For primitive values, sanitize if it's a string
  if (typeof obj === 'string') {
    const fieldName = path.split('.').pop() || '';
    return sanitizeValue(obj, fieldName);
  }

  return obj;
}

/**
 * Middleware to sanitize all input data (body, query, params)
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      const sanitizedBody = sanitizeObject(req.body);
      req.body = sanitizedBody;
    }

    // Sanitize query parameters - mutate in place for read-only objects
    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery = sanitizeObject(req.query);
      // Clear existing properties and copy sanitized ones
      Object.keys(req.query).forEach(key => delete (req.query as any)[key]);
      Object.assign(req.query, sanitizedQuery);
    }

    // Sanitize URL parameters - mutate in place for read-only objects
    if (req.params && typeof req.params === 'object') {
      const sanitizedParams = sanitizeObject(req.params);
      // Clear existing properties and copy sanitized ones
      Object.keys(req.params).forEach(key => delete (req.params as any)[key]);
      Object.assign(req.params, sanitizedParams);
    }

    next();
  } catch (error) {
    logger.error('Error during input sanitization', error);
    next(); // Continue even if sanitization fails
  }
}

/**
 * Strict sanitization for specific sensitive operations
 */
export function strictSanitize(allowedFields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      
      // Remove any fields not in the allowed list
      if (req.body && typeof req.body === 'object') {
        const sanitizedBody: any = {};
        
        for (const field of allowedFields) {
          if (field in req.body) {
            sanitizedBody[field] = req.body[field];
          }
        }
        
        req.body = sanitizeObject(sanitizedBody);
      }
      
      next();
    } catch (error) {
      logger.error('Error during strict sanitization', error);
      next();
    }
  };
}

/**
 * Sanitize output before sending to client
 */
export function sanitizeOutput(data: any): any {
  // Deep clone to avoid modifying original data
  const cloned = JSON.parse(JSON.stringify(data));
  
  // Remove any potentially sensitive fields
  const sensitiveFields = ['password', 'passwordHash', 'apiKey', 'secret', 'pan', 'cvv'];
  
  function removeSensitive(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(removeSensitive);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (!sensitiveFields.includes(key)) {
          cleaned[key] = removeSensitive(value);
        }
      }
      
      return cleaned;
    }
    
    return obj;
  }
  
  return removeSensitive(cloned);
}