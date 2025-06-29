"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const userService_1 = require("../../services/userService");
const tokenService_1 = require("../../services/tokenService");
const userRepository_1 = require("../../repositories/userRepository");
const responseFormatter_1 = require("../../utils/responseFormatter");
const env_1 = require("../../config/env");
const logger_1 = __importDefault(require("../../utils/logger"));
class AuthController {
    static async register(req, res, next) {
        try {
            if (!env_1.features.enableRegistration) {
                (0, responseFormatter_1.sendError)(res, 'REGISTRATION_DISABLED', 'Registration is currently disabled', 403);
                return;
            }
            const result = await userService_1.UserService.register(req.body);
            // Set refresh token as httpOnly cookie
            res.cookie('refreshToken', result.tokens.refreshToken, {
                httpOnly: true,
                secure: env_1.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            (0, responseFormatter_1.sendSuccess)(res, {
                user: result.user,
                accessToken: result.tokens.accessToken,
                expiresIn: result.tokens.expiresIn
            }, 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async login(req, res, next) {
        try {
            const result = await userService_1.UserService.login(req.body);
            // Set refresh token as httpOnly cookie
            res.cookie('refreshToken', result.tokens.refreshToken, {
                httpOnly: true,
                secure: env_1.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            (0, responseFormatter_1.sendSuccess)(res, {
                user: result.user,
                accessToken: result.tokens.accessToken,
                expiresIn: result.tokens.expiresIn
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async refreshToken(req, res, next) {
        try {
            // Get refresh token from body or cookie
            const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
            if (!refreshToken) {
                (0, responseFormatter_1.sendError)(res, 'REFRESH_TOKEN_REQUIRED', 'Refresh token is required', 400);
                return;
            }
            // First verify the refresh token to get the user ID
            const payload = await tokenService_1.TokenService.verifyRefreshToken(refreshToken);
            // Fetch the user to get their current role
            const user = await userRepository_1.UserRepository.findById(payload.sub);
            if (!user) {
                (0, responseFormatter_1.sendError)(res, 'USER_NOT_FOUND', 'User not found', 404);
                return;
            }
            // Generate new tokens with the user's current role
            const tokens = await tokenService_1.TokenService.refreshTokens(refreshToken, user.role);
            // Set new refresh token as httpOnly cookie
            res.cookie('refreshToken', tokens.refreshToken, {
                httpOnly: true,
                secure: env_1.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            (0, responseFormatter_1.sendSuccess)(res, {
                accessToken: tokens.accessToken,
                expiresIn: tokens.expiresIn
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async logout(req, res, next) {
        try {
            if (req.user) {
                await tokenService_1.TokenService.revokeSession(req.user.sessionId);
                logger_1.default.info(`User ${req.user.email} logged out`);
            }
            // Clear refresh token cookie
            res.clearCookie('refreshToken');
            (0, responseFormatter_1.sendSuccess)(res, { message: 'Logged out successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    static async getProfile(req, res, next) {
        try {
            if (!req.user) {
                (0, responseFormatter_1.sendError)(res, 'UNAUTHORIZED', 'User not authenticated', 401);
                return;
            }
            const profile = await userService_1.UserService.getProfile(req.user.id);
            (0, responseFormatter_1.sendSuccess)(res, profile);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map