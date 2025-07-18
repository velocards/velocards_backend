import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../../config/env';
import logger from '../../utils/logger';

// Rate limiter configurations for different endpoint types

// Default rate limiter for general API endpoints
export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      }
    });
  },
  skip: (_req) => env.NODE_ENV === 'test' // Skip rate limiting in test environment
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: false, // Count successful requests too
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later'
      }
    });
  },
  skip: (_req) => env.NODE_ENV === 'test'
});

// Very strict rate limiter for sensitive operations (password reset, etc.)
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'STRICT_RATE_LIMIT_EXCEEDED',
        message: 'Too many attempts, please try again later'
      }
    });
  },
  skip: (_req) => env.NODE_ENV === 'test'
});

// Card creation rate limiter - per user, not per IP
export const cardCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit to 5 card creations per minute
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return (req as any).user?.sub || req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'CARD_CREATION_LIMIT_EXCEEDED',
        message: 'Too many card creation attempts, please wait before creating more cards'
      }
    });
  },
  skip: (_req) => env.NODE_ENV === 'test'
});

// Transaction rate limiter - more lenient for viewing
export const transactionReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for reading transactions
  keyGenerator: (req: Request) => {
    return (req as any).user?.sub || req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'TRANSACTION_READ_LIMIT_EXCEEDED',
        message: 'Too many requests, please slow down'
      }
    });
  },
  skip: (_req) => env.NODE_ENV === 'test'
});

// Withdrawal/sensitive financial operations limiter
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 withdrawal attempts per hour
  keyGenerator: (req: Request) => {
    return (req as any).user?.sub || req.ip || 'unknown';
  },
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Withdrawal rate limit exceeded', {
      userId: (req as any).user?.sub,
      ip: req.ip
    });
    res.status(429).json({
      success: false,
      error: {
        code: 'WITHDRAWAL_LIMIT_EXCEEDED',
        message: 'Too many withdrawal attempts, please try again later'
      }
    });
  },
  skip: (_req) => env.NODE_ENV === 'test'
});

// API-wide rate limiter to prevent DDoS
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
        message: 'Service temporarily unavailable due to high traffic'
      }
    });
  },
  skip: (_req) => env.NODE_ENV === 'test'
});