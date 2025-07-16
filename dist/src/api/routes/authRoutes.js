"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middlewares/auth");
const authorize_1 = require("../middlewares/authorize");
const validate_1 = require("../middlewares/validate");
const authValidators_1 = require("../validators/authValidators");
const rateLimiter_1 = require("../middlewares/rateLimiter");
const roles_1 = require("../../config/roles");
const router = (0, express_1.Router)();
// Public routes with rate limiting
router.post('/register', rateLimiter_1.authLimiter, // 5 requests per 15 minutes
(0, validate_1.validate)(authValidators_1.registerSchema), authController_1.AuthController.register.bind(authController_1.AuthController));
router.post('/login', rateLimiter_1.authLimiter, // 5 requests per 15 minutes
(0, validate_1.validate)(authValidators_1.loginSchema), authController_1.AuthController.login.bind(authController_1.AuthController));
router.post('/refresh', rateLimiter_1.authLimiter, // 5 requests per 15 minutes
(0, validate_1.validate)(authValidators_1.refreshTokenSchema), authController_1.AuthController.refreshToken.bind(authController_1.AuthController));
// Password reset endpoints
router.post('/forgot-password', rateLimiter_1.strictLimiter, // 3 requests per hour
(0, validate_1.validate)(authValidators_1.forgotPasswordSchema), authController_1.AuthController.forgotPassword.bind(authController_1.AuthController));
router.post('/reset-password', rateLimiter_1.strictLimiter, // 3 requests per hour
(0, validate_1.validate)(authValidators_1.resetPasswordSchema), authController_1.AuthController.resetPassword.bind(authController_1.AuthController));
router.get('/reset-password/validate/:token', rateLimiter_1.strictLimiter, // 3 requests per hour
authController_1.AuthController.validateResetToken.bind(authController_1.AuthController));
// CAPTCHA status route
router.get('/captcha-required/:action', authController_1.AuthController.checkCaptchaRequired.bind(authController_1.AuthController));
// Email verification endpoints
router.post('/verify-email', rateLimiter_1.authLimiter, // 5 requests per 15 minutes
(0, validate_1.validate)(authValidators_1.verifyEmailSchema), authController_1.AuthController.verifyEmail.bind(authController_1.AuthController));
router.post('/resend-verification', rateLimiter_1.strictLimiter, // 3 requests per hour
(0, validate_1.validate)(authValidators_1.resendVerificationSchema), authController_1.AuthController.resendVerificationEmail.bind(authController_1.AuthController));
// Protected routes
router.post('/logout', auth_1.authenticate, authController_1.AuthController.logout.bind(authController_1.AuthController));
router.get('/profile', auth_1.authenticate, (0, authorize_1.authorize)(roles_1.PERMISSIONS.PROFILE_READ), // User must have profile:read permission
authController_1.AuthController.getProfile.bind(authController_1.AuthController));
router.get('/verification-status', auth_1.authenticate, authController_1.AuthController.checkVerificationStatus.bind(authController_1.AuthController));
// Google OAuth routes
router.get('/google', authController_1.AuthController.googleAuth.bind(authController_1.AuthController));
router.get('/google/callback', authController_1.AuthController.googleCallback.bind(authController_1.AuthController));
router.post('/google/link', auth_1.authenticate, authController_1.AuthController.linkGoogleAccount.bind(authController_1.AuthController));
router.delete('/google/link', auth_1.authenticate, authController_1.AuthController.unlinkGoogleAccount.bind(authController_1.AuthController));
router.get('/linked-providers', auth_1.authenticate, authController_1.AuthController.getLinkedProviders.bind(authController_1.AuthController));
exports.default = router;
//# sourceMappingURL=authRoutes.js.map