"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOnly = void 0;
exports.authorize = authorize;
exports.authorizeOwnership = authorizeOwnership;
exports.combineAuthorizations = combineAuthorizations;
const roles_1 = require("../../config/roles");
const errors_1 = require("../../utils/errors");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Authorization middleware factory
 * Checks if the authenticated user has the required permissions
 *
 * @param requiredPermissions - Single permission or array of permissions required
 * @param requireAll - If true, user must have ALL permissions. If false, ANY permission is sufficient
 * @returns Express middleware function
 */
function authorize(requiredPermissions, requireAll = true) {
    return (req, res, next) => {
        try {
            // Ensure user is authenticated
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.id
                    }
                });
                return;
            }
            const { role, permissions: userPermissions } = req.user;
            // Check if user has a valid role
            if (!role) {
                logger_1.default.error('User missing role', { userId: req.user.sub });
                throw new errors_1.ForbiddenError('User role not assigned');
            }
            // Convert single permission to array for consistency
            const permissionsToCheck = Array.isArray(requiredPermissions)
                ? requiredPermissions
                : [requiredPermissions];
            // Check permissions
            let hasPermission = false;
            if (userPermissions && userPermissions.length > 0) {
                // Use permissions from JWT if available
                hasPermission = requireAll
                    ? permissionsToCheck.every(p => userPermissions.includes(p))
                    : permissionsToCheck.some(p => userPermissions.includes(p));
            }
            else {
                // Fall back to role-based permission check
                hasPermission = requireAll
                    ? (0, roles_1.roleHasAllPermissions)(role, permissionsToCheck)
                    : (0, roles_1.roleHasAnyPermission)(role, permissionsToCheck);
            }
            if (!hasPermission) {
                logger_1.default.warn('Authorization failed', {
                    userId: req.user.sub,
                    role,
                    requiredPermissions: permissionsToCheck,
                    requireAll,
                    path: req.path,
                    method: req.method
                });
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Insufficient permissions to access this resource'
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.id
                    }
                });
                return;
            }
            // User has required permissions, proceed
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
/**
 * Shorthand middleware for admin-only routes
 */
exports.adminOnly = authorize([roles_1.UserRole.ADMIN], true);
/**
 * Check if user owns the resource they're trying to access
 * This is for resource-based authorization (e.g., can only edit own profile)
 */
function authorizeOwnership(resourceUserIdExtractor) {
    return (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication required'
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.id
                    }
                });
                return;
            }
            const resourceUserId = resourceUserIdExtractor(req);
            if (!resourceUserId) {
                throw new errors_1.ForbiddenError('Resource not found');
            }
            // Admins can access any resource
            if (req.user.role === roles_1.UserRole.ADMIN) {
                return next();
            }
            // Check if user owns the resource
            if (req.user.sub !== resourceUserId) {
                logger_1.default.warn('Ownership authorization failed', {
                    userId: req.user.sub,
                    resourceUserId,
                    path: req.path,
                    method: req.method
                });
                res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You can only access your own resources'
                    },
                    meta: {
                        timestamp: new Date().toISOString(),
                        requestId: req.id
                    }
                });
                return;
            }
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
/**
 * Combine multiple authorization checks
 * All checks must pass for the request to proceed
 */
function combineAuthorizations(...authorizations) {
    return async (req, res, next) => {
        for (const authCheck of authorizations) {
            await new Promise((resolve, reject) => {
                authCheck(req, res, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }).catch(next);
            // If response was sent by any auth check, stop processing
            if (res.headersSent) {
                return;
            }
        }
        next();
    };
}
//# sourceMappingURL=authorize.js.map