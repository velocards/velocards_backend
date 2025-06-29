"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../../utils/errors");
const logger_1 = __importDefault(require("../../utils/logger"));
const env_1 = require("../../config/env");
function errorHandler(err, req, res, _next) {
    // Log error
    logger_1.default.error({
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name
        },
        request: {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userId: req.user?.id
        }
    });
    // Handle known errors
    if (err instanceof errors_1.AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.details && { details: err.details })
            },
            meta: {
                timestamp: new Date().toISOString(),
                requestId: req.id
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
                requestId: req.id
            }
        });
        return;
    }
    // Handle unknown errors
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: env_1.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred'
                : err.message,
            ...(env_1.env.NODE_ENV !== 'production' && { stack: err.stack })
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: req.id
        }
    });
}
//# sourceMappingURL=errorHandler.js.map