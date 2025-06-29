"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const env_1 = require("../config/env");
const redis_1 = __importDefault(require("../config/redis"));
const errors_1 = require("../utils/errors");
const roles_1 = require("../config/roles");
class TokenService {
    static REFRESH_TOKEN_PREFIX = 'refresh_token:';
    static SESSION_PREFIX = 'session:';
    static async generateTokenPair(userId, email, role) {
        const sessionId = (0, uuid_1.v4)();
        // Get permissions for the role
        const permissions = role ? (0, roles_1.getRolePermissions)(role) : [];
        // Generate access token with role and permissions
        const accessToken = jsonwebtoken_1.default.sign({
            sub: userId,
            email,
            sessionId,
            type: 'access',
            role,
            permissions
        }, env_1.jwt.accessSecret, {
            expiresIn: env_1.jwt.accessExpiry,
            issuer: 'digistreets'
        });
        // Generate refresh token (doesn't need role/permissions)
        const refreshToken = jsonwebtoken_1.default.sign({
            sub: userId,
            email,
            sessionId,
            type: 'refresh'
        }, env_1.jwt.refreshSecret, {
            expiresIn: env_1.jwt.refreshExpiry,
            issuer: 'digistreets'
        });
        // Try to store session in Redis, but don't fail if Redis is down
        try {
            await redis_1.default.setex(`${this.SESSION_PREFIX}${sessionId}`, 7 * 24 * 60 * 60, // 7 days
            JSON.stringify({
                userId,
                email,
                createdAt: new Date().toISOString()
            }));
            // Store refresh token in Redis for revocation checking
            await redis_1.default.setex(`${this.REFRESH_TOKEN_PREFIX}${sessionId}`, 7 * 24 * 60 * 60, // 7 days
            refreshToken);
        }
        catch (redisError) {
            // Log the error but don't fail the registration
            console.warn('Redis storage failed during token generation, continuing without session persistence:', redisError);
            // In production, you might want to alert monitoring systems here
        }
        return {
            accessToken,
            refreshToken,
            expiresIn: 900 // 15 minutes in seconds
        };
    }
    static async verifyAccessToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.jwt.accessSecret);
            // Check if session exists (only if Redis is available)
            try {
                const sessionExists = await redis_1.default.exists(`${this.SESSION_PREFIX}${payload.sessionId}`);
                if (!sessionExists) {
                    throw new errors_1.AuthenticationError('Session expired');
                }
            }
            catch (redisError) {
                // If Redis is down, we'll allow the token through (degraded mode)
                console.warn('Redis unavailable during session check, allowing token:', redisError);
            }
            return payload;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new errors_1.AuthenticationError('Token expired');
            }
            throw new errors_1.AuthenticationError('Invalid token');
        }
    }
    static async verifyRefreshToken(token) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, env_1.jwt.refreshSecret);
            // Check if refresh token exists in Redis (if Redis is available)
            try {
                const storedToken = await redis_1.default.get(`${this.REFRESH_TOKEN_PREFIX}${payload.sessionId}`);
                if (!storedToken || storedToken !== token) {
                    throw new errors_1.AuthenticationError('Invalid refresh token');
                }
            }
            catch (redisError) {
                // If Redis is down, we'll still allow the refresh if the JWT is valid
                console.warn('Redis unavailable during refresh token check, allowing token:', redisError);
            }
            return payload;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new errors_1.AuthenticationError('Refresh token expired');
            }
            throw new errors_1.AuthenticationError('Invalid refresh token');
        }
    }
    static async refreshTokens(refreshToken, userRole) {
        const payload = await this.verifyRefreshToken(refreshToken);
        // Try to delete old refresh token (don't fail if Redis is down)
        try {
            await redis_1.default.del(`${this.REFRESH_TOKEN_PREFIX}${payload.sessionId}`);
        }
        catch (redisError) {
            console.warn('Redis unavailable during token deletion:', redisError);
        }
        // Generate new token pair with role
        return this.generateTokenPair(payload.sub, payload.email, userRole);
    }
    static async revokeSession(sessionId) {
        try {
            await redis_1.default.del([
                `${this.SESSION_PREFIX}${sessionId}`,
                `${this.REFRESH_TOKEN_PREFIX}${sessionId}`
            ]);
        }
        catch (redisError) {
            console.warn('Redis unavailable during session revocation:', redisError);
            // Don't throw - logout should still succeed even if Redis is down
        }
    }
    static async revokeAllUserSessions(userId) {
        // Get all sessions for user
        const keys = await redis_1.default.keys(`${this.SESSION_PREFIX}*`);
        for (const key of keys) {
            const session = await redis_1.default.get(key);
            if (session) {
                const sessionData = JSON.parse(session);
                if (sessionData.userId === userId) {
                    const sessionId = key.replace(this.SESSION_PREFIX, '');
                    await this.revokeSession(sessionId);
                }
            }
        }
    }
}
exports.TokenService = TokenService;
//# sourceMappingURL=tokenService.js.map