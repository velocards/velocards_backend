"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = exports.InsufficientBalanceError = exports.InternalError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    code;
    statusCode;
    details;
    isOperational;
    constructor(code, message, statusCode = 400, details = null) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AppError';
        this.isOperational = true;
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(details) {
        super('VALIDATION_ERROR', 'Validation failed', 400, details);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super('AUTHENTICATION_ERROR', message, 401);
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor(message = 'Insufficient permissions') {
        super('AUTHORIZATION_ERROR', message, 403);
    }
}
exports.AuthorizationError = AuthorizationError;
class ForbiddenError extends AppError {
    constructor(message = 'Access forbidden') {
        super('FORBIDDEN', message, 403);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(resource) {
        super('NOT_FOUND', `${resource} not found`, 404);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super('CONFLICT', message, 409);
    }
}
exports.ConflictError = ConflictError;
class InternalError extends AppError {
    constructor(message = 'Internal server error') {
        super('INTERNAL_ERROR', message, 500);
    }
}
exports.InternalError = InternalError;
class InsufficientBalanceError extends AppError {
    constructor(required, available) {
        super('INSUFFICIENT_BALANCE', `Insufficient balance. Required: $${required}, Available: $${available}`, 400);
        this.details = { required, available };
    }
}
exports.InsufficientBalanceError = InsufficientBalanceError;
class DatabaseError extends AppError {
    constructor(message, originalError) {
        super('DATABASE_ERROR', message, 500);
        if (originalError) {
            this.details = {
                code: originalError.code,
                detail: originalError.detail,
                hint: originalError.hint
            };
        }
    }
}
exports.DatabaseError = DatabaseError;
//# sourceMappingURL=errors.js.map