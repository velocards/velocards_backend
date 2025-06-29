"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalLimiter = exports.withdrawalLimiter = exports.transactionReadLimiter = exports.cardCreationLimiter = exports.strictLimiter = exports.authLimiter = exports.defaultLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../../config/env");
const logger_1 = __importDefault(require("../../utils/logger"));
// Rate limiter configurations for different endpoint types
// Default rate limiter for general API endpoints
exports.defaultLimiter = (0, express_rate_limit_1.default)({
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
    skip: (_req) => env_1.env.NODE_ENV === 'test' // Skip rate limiting in test environment
});
// Strict rate limiter for authentication endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
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
    skip: (_req) => env_1.env.NODE_ENV === 'test'
});
// Very strict rate limiter for sensitive operations (password reset, etc.)
exports.strictLimiter = (0, express_rate_limit_1.default)({
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
    skip: (_req) => env_1.env.NODE_ENV === 'test'
});
// Card creation rate limiter - per user, not per IP
exports.cardCreationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit to 5 card creations per minute
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise fall back to IP
        return req.user?.sub || req.ip || 'unknown';
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
    skip: (_req) => env_1.env.NODE_ENV === 'test'
});
// Transaction rate limiter - more lenient for viewing
exports.transactionReadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute for reading transactions
    keyGenerator: (req) => {
        return req.user?.sub || req.ip || 'unknown';
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
    skip: (_req) => env_1.env.NODE_ENV === 'test'
});
// Withdrawal/sensitive financial operations limiter
exports.withdrawalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 withdrawal attempts per hour
    keyGenerator: (req) => {
        return req.user?.sub || req.ip || 'unknown';
    },
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn('Withdrawal rate limit exceeded', {
            userId: req.user?.sub,
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
    skip: (_req) => env_1.env.NODE_ENV === 'test'
});
// API-wide rate limiter to prevent DDoS
exports.globalLimiter = (0, express_rate_limit_1.default)({
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
    skip: (_req) => env_1.env.NODE_ENV === 'test'
});
//# sourceMappingURL=rateLimiter.js.map