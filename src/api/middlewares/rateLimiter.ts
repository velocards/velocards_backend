import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { env } from '../../config/env';
import logger from '../../utils/logger';

// Get whitelisted IPs from environment variable
const getWhitelistedIPs = (): string[] => {
  if (!env.RATE_LIMIT_WHITELIST_IPS) {
    return [];
  }
  return env.RATE_LIMIT_WHITELIST_IPS.split(',').map(ip => ip.trim()).filter(ip => ip.length > 0);
};

// Function to check if request should skip rate limiting
function shouldSkipRateLimit(req: Request): boolean {
  const clientIP = req.ip || req.socket.remoteAddress || '';
  const forwarded = req.headers['x-forwarded-for'] as string;
  const whitelistedIPs = getWhitelistedIPs();
  
  // Skip in test environment
  if (env.NODE_ENV === 'test') {
    return true;
  }
  
  // No whitelisted IPs configured
  if (whitelistedIPs.length === 0) {
    return false;
  }
  
  // Check if client IP is whitelisted
  for (const whitelistedIP of whitelistedIPs) {
    // Check direct IP
    if (clientIP === whitelistedIP || clientIP === `::ffff:${whitelistedIP}`) {
      logger.info(`Rate limit bypassed for whitelisted IP: ${clientIP}`);
      return true;
    }
    
    // Check forwarded IPs
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      if (ips.includes(whitelistedIP)) {
        logger.info(`Rate limit bypassed for whitelisted forwarded IP: ${whitelistedIP}`);
        return true;
      }
    }
  }
  
  return false;
}

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
  skip: (req) => shouldSkipRateLimit(req) // Skip rate limiting for whitelisted IPs and test environment
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
  skip: (req) => shouldSkipRateLimit(req)
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
  skip: (req) => shouldSkipRateLimit(req)
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
  skip: (req) => shouldSkipRateLimit(req)
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
  skip: (req) => shouldSkipRateLimit(req)
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
  skip: (req) => shouldSkipRateLimit(req)
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
  skip: (req) => shouldSkipRateLimit(req)
});

// KYC operations rate limiter
export const kycLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 KYC operations per 15 minutes
  keyGenerator: (req: Request) => {
    return (req as any).user?.sub || req.ip || 'unknown';
  },
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'KYC_RATE_LIMIT_EXCEEDED',
        message: 'Too many KYC verification attempts, please try again later'
      }
    });
  },
  skip: (req) => shouldSkipRateLimit(req)
});

// Webhook rate limiter - more lenient for external services
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhook calls per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'WEBHOOK_RATE_LIMIT_EXCEEDED',
        message: 'Too many webhook requests'
      }
    });
  },
  skip: (req) => shouldSkipRateLimit(req)
});

// Export grouped rate limiters for easier use in routes
export const rateLimiter = {
  default: defaultLimiter,
  auth: authLimiter,
  strict: strictLimiter,
  cardCreation: cardCreationLimiter,
  transactionRead: transactionReadLimiter,
  withdrawal: withdrawalLimiter,
  global: globalLimiter,
  kyc: kycLimiter,
  webhook: webhookLimiter
};