"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuth = optionalAuth;
const tokenService_1 = require("../../services/tokenService");
const errors_1 = require("../../utils/errors");
async function authenticate(req, _res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw new errors_1.AuthenticationError('No authorization header');
        }
        const [bearer, token] = authHeader.split(' ');
        if (bearer !== 'Bearer' || !token) {
            throw new errors_1.AuthenticationError('Invalid authorization header format');
        }
        const payload = await tokenService_1.TokenService.verifyAccessToken(token);
        req.user = {
            id: payload.sub,
            email: payload.email,
            sessionId: payload.sessionId,
            sub: payload.sub, // Keep both for compatibility
            ...(payload.role && { role: payload.role }),
            ...(payload.permissions && { permissions: payload.permissions })
        };
        next();
    }
    catch (error) {
        next(error);
    }
}
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return next();
    }
    authenticate(req, res, next);
}
//# sourceMappingURL=auth.js.map