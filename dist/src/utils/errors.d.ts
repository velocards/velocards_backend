export declare class AppError extends Error {
    code: string;
    statusCode: number;
    details: any;
    isOperational: boolean;
    constructor(code: string, message: string, statusCode?: number, details?: any);
}
export declare class ValidationError extends AppError {
    constructor(details: any);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class AuthorizationError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class InternalError extends AppError {
    constructor(message?: string);
}
export declare class InsufficientBalanceError extends AppError {
    constructor(required: number, available: number);
}
export declare class DatabaseError extends AppError {
    constructor(message: string, originalError?: any);
}
//# sourceMappingURL=errors.d.ts.map