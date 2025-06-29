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
// Password reset endpoints (to be implemented)
// router.post('/forgot-password',
//   strictLimiter, // 3 requests per hour
//   validate(forgotPasswordSchema),
//   AuthController.forgotPassword.bind(AuthController)
// );
// router.post('/reset-password',
//   strictLimiter, // 3 requests per hour
//   validate(resetPasswordSchema),
//   AuthController.resetPassword.bind(AuthController)
// );
// Protected routes
router.post('/logout', auth_1.authenticate, authController_1.AuthController.logout.bind(authController_1.AuthController));
router.get('/profile', auth_1.authenticate, (0, authorize_1.authorize)(roles_1.PERMISSIONS.PROFILE_READ), // User must have profile:read permission
authController_1.AuthController.getProfile.bind(authController_1.AuthController));
exports.default = router;
//# sourceMappingURL=authRoutes.js.map