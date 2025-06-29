"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
exports.sendPaginatedSuccess = sendPaginatedSuccess;
function sendSuccess(res, data, statusCode = 200, meta) {
    const response = {
        success: true,
        data,
        meta: {
            timestamp: new Date().toISOString(),
            ...meta
        }
    };
    return res.status(statusCode).json(response);
}
function sendError(res, code, message, statusCode = 400, details) {
    const response = {
        success: false,
        error: {
            code,
            message,
            details
        },
        meta: {
            timestamp: new Date().toISOString(),
            requestId: res.req.id
        }
    };
    return res.status(statusCode).json(response);
}
function sendPaginatedSuccess(res, data, pagination, statusCode = 200) {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    return sendSuccess(res, data, statusCode, {
        pagination: {
            ...pagination,
            totalPages
        }
    });
}
//# sourceMappingURL=responseFormatter.js.map