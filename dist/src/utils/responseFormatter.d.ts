import { Response } from 'express';
interface SuccessResponse<T = any> {
    success: true;
    data: T;
    meta?: {
        timestamp: string;
        requestId?: string;
        pagination?: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}
interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: any;
    };
    meta: {
        timestamp: string;
        requestId?: string;
    };
}
export declare function sendSuccess<T>(res: Response, data: T, statusCode?: number, meta?: Partial<SuccessResponse['meta']>): Response;
export declare function formatResponse<T>(data: T, meta?: Partial<SuccessResponse['meta']>): SuccessResponse<T>;
export declare function sendError(res: Response, code: string, message: string, statusCode?: number, details?: any): Response;
export declare function sendPaginatedSuccess<T>(res: Response, data: T[], pagination: {
    page: number;
    limit: number;
    total: number;
}, statusCode?: number): Response;
export declare function formatSuccessResponse<T>(data: T, meta?: Partial<SuccessResponse['meta']>): SuccessResponse<T>;
export declare function formatErrorResponse(code: string, message: string, details?: any): ErrorResponse;
export {};
//# sourceMappingURL=responseFormatter.d.ts.map