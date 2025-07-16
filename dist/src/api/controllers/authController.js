"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const userService_1 = require("../../services/userService");
const tokenService_1 = require("../../services/tokenService");
const userRepository_1 = require("../../repositories/userRepository");
const passwordResetService_1 = require("../../services/passwordResetService");
const emailVerificationService_1 = require("../../services/emailVerificationService");
const googleOAuthService_1 = require("../../services/googleOAuthService");
const captchaService_1 = require("../../services/captchaService");
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
            // Verify CAPTCHA if provided or required
            if (captchaService_1.CaptchaService.isRequired('register') || req.body.captchaToken) {
                if (!req.body.captchaToken) {
                    (0, responseFormatter_1.sendError)(res, 'CAPTCHA_REQUIRED', 'CAPTCHA verification is required', 400);
                    return;
                }
                const clientIp = req.ip || req.socket.remoteAddress;
                await captchaService_1.CaptchaService.verify(req.body.captchaToken, clientIp);
            }
            const result = await userService_1.UserService.register(req.body);
            // Send verification email
            try {
                await emailVerificationService_1.EmailVerificationService.sendVerificationEmail(result.user.id);
            }
            catch (error) {
                // Log error but don't fail registration
                logger_1.default.error('Failed to send verification email:', error);
            }
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
                expiresIn: result.tokens.expiresIn,
                message: 'Registration successful. Please check your email to verify your account.'
            }, 201);
        }
        catch (error) {
            next(error);
        }
    }
    static async login(req, res, next) {
        try {
            // Verify CAPTCHA if provided or required
            if (captchaService_1.CaptchaService.isRequired('login') || req.body.captchaToken) {
                if (!req.body.captchaToken) {
                    (0, responseFormatter_1.sendError)(res, 'CAPTCHA_REQUIRED', 'CAPTCHA verification is required', 400);
                    return;
                }
                const clientIp = req.ip || req.socket.remoteAddress;
                await captchaService_1.CaptchaService.verify(req.body.captchaToken, clientIp);
            }
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
    static async forgotPassword(req, res, _next) {
        try {
            // Verify CAPTCHA if provided or required
            if (captchaService_1.CaptchaService.isRequired('forgot-password') || req.body.captchaToken) {
                if (!req.body.captchaToken) {
                    (0, responseFormatter_1.sendError)(res, 'CAPTCHA_REQUIRED', 'CAPTCHA verification is required', 400);
                    return;
                }
                const clientIp = req.ip || req.socket.remoteAddress;
                await captchaService_1.CaptchaService.verify(req.body.captchaToken, clientIp);
            }
            await passwordResetService_1.PasswordResetService.requestPasswordReset(req.body.email);
            // Always return success to prevent email enumeration
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'If an account exists with that email address, a password reset link has been sent.'
            });
        }
        catch (error) {
            // Log the error but don't expose details to user
            logger_1.default.error('Password reset request error', error);
            // Still return success to prevent email enumeration
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'If an account exists with that email address, a password reset link has been sent.'
            });
        }
    }
    static async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            await passwordResetService_1.PasswordResetService.resetPassword(token, password);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Password has been reset successfully. You can now login with your new password.'
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async validateResetToken(req, res, next) {
        try {
            const { token } = req.params;
            const result = await passwordResetService_1.PasswordResetService.validateToken(token);
            (0, responseFormatter_1.sendSuccess)(res, {
                valid: true,
                email: result.email
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async verifyEmail(req, res, next) {
        try {
            const { token } = req.body;
            const result = await emailVerificationService_1.EmailVerificationService.verifyEmail(token);
            (0, responseFormatter_1.sendSuccess)(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    static async resendVerificationEmail(req, res, _next) {
        try {
            await emailVerificationService_1.EmailVerificationService.resendVerificationEmail(req.body.email);
            // Always return success to prevent email enumeration
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'If an account exists with that email address, a verification email has been sent.'
            });
        }
        catch (error) {
            // Log the error but don't expose details to user
            logger_1.default.error('Resend verification email error', error);
            // Still return success to prevent email enumeration
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'If an account exists with that email address, a verification email has been sent.'
            });
        }
    }
    static async checkVerificationStatus(req, res, next) {
        try {
            if (!req.user) {
                (0, responseFormatter_1.sendError)(res, 'UNAUTHORIZED', 'User not authenticated', 401);
                return;
            }
            const user = await userRepository_1.UserRepository.findById(req.user.id);
            if (!user) {
                (0, responseFormatter_1.sendError)(res, 'NOT_FOUND', 'User not found', 404);
                return;
            }
            (0, responseFormatter_1.sendSuccess)(res, {
                email_verified: user.email_verified,
                email: user.email
            });
        }
        catch (error) {
            next(error);
        }
    }
    // Google OAuth methods
    static async googleAuth(req, res, next) {
        try {
            const state = req.query['state'] || '';
            const authUrl = googleOAuthService_1.GoogleOAuthService.generateAuthUrl(state);
            res.redirect(authUrl);
        }
        catch (error) {
            next(error);
        }
    }
    static async googleCallback(req, res) {
        try {
            const { code, state } = req.query;
            if (!code || typeof code !== 'string') {
                (0, responseFormatter_1.sendError)(res, 'INVALID_REQUEST', 'Authorization code is required', 400);
                return;
            }
            const result = await googleOAuthService_1.GoogleOAuthService.handleCallback(code);
            // Set refresh token as httpOnly cookie
            res.cookie('refreshToken', result.tokens.refreshToken, {
                httpOnly: true,
                secure: env_1.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            // Redirect to frontend with access token in URL
            const redirectUrl = new URL(`${env_1.env.FRONTEND_URL}/auth/google/callback`);
            redirectUrl.searchParams.set('access_token', result.tokens.accessToken);
            redirectUrl.searchParams.set('expires_in', result.tokens.expiresIn.toString());
            if (state) {
                redirectUrl.searchParams.set('state', state);
            }
            res.redirect(redirectUrl.toString());
        }
        catch (error) {
            // Redirect to frontend with error
            const errorUrl = new URL(`${env_1.env.FRONTEND_URL}/auth/google/callback`);
            errorUrl.searchParams.set('error', 'authentication_failed');
            errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'Failed to authenticate with Google');
            res.redirect(errorUrl.toString());
        }
    }
    static async linkGoogleAccount(req, res, next) {
        try {
            if (!req.user) {
                (0, responseFormatter_1.sendError)(res, 'UNAUTHORIZED', 'User not authenticated', 401);
                return;
            }
            const { code } = req.body;
            if (!code || typeof code !== 'string') {
                (0, responseFormatter_1.sendError)(res, 'INVALID_REQUEST', 'Authorization code is required', 400);
                return;
            }
            await googleOAuthService_1.GoogleOAuthService.linkGoogleAccount(req.user.id, code);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Google account linked successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async unlinkGoogleAccount(req, res, next) {
        try {
            if (!req.user) {
                (0, responseFormatter_1.sendError)(res, 'UNAUTHORIZED', 'User not authenticated', 401);
                return;
            }
            await googleOAuthService_1.GoogleOAuthService.unlinkGoogleAccount(req.user.id);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Google account unlinked successfully'
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getLinkedProviders(req, res, next) {
        try {
            if (!req.user) {
                (0, responseFormatter_1.sendError)(res, 'UNAUTHORIZED', 'User not authenticated', 401);
                return;
            }
            const providers = await googleOAuthService_1.GoogleOAuthService.getLinkedProviders(req.user.id);
            (0, responseFormatter_1.sendSuccess)(res, {
                providers
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async checkCaptchaRequired(req, res, next) {
        try {
            const { action } = req.params;
            const required = captchaService_1.CaptchaService.isRequired(action);
            (0, responseFormatter_1.sendSuccess)(res, {
                required,
                action
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map