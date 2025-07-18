import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { generateCSRFToken } from '../middlewares/csrf';
import { registerSchema, loginSchema, refreshTokenSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, resendVerificationSchema, changePasswordSchema } from '../validators/authValidators';
import { authLimiter, strictLimiter } from '../middlewares/rateLimiter';
import { PERMISSIONS } from '../../config/roles';

const router = Router();

// Public routes with rate limiting
router.post('/register',
  authLimiter, // 5 requests per 15 minutes
  validate(registerSchema),
  AuthController.register.bind(AuthController)
);

router.post('/login',
  authLimiter, // 5 requests per 15 minutes
  validate(loginSchema),
  AuthController.login.bind(AuthController)
);

router.post('/refresh',
  authLimiter, // 5 requests per 15 minutes
  validate(refreshTokenSchema),
  AuthController.refreshToken.bind(AuthController)
);

// Password reset endpoints
router.post('/forgot-password',
  strictLimiter, // 3 requests per hour
  validate(forgotPasswordSchema),
  AuthController.forgotPassword.bind(AuthController)
);

router.post('/reset-password',
  strictLimiter, // 3 requests per hour
  validate(resetPasswordSchema),
  AuthController.resetPassword.bind(AuthController)
);

router.get('/reset-password/validate/:token',
  strictLimiter, // 3 requests per hour
  AuthController.validateResetToken.bind(AuthController)
);

// CAPTCHA status route
router.get('/captcha-required/:action',
  AuthController.checkCaptchaRequired.bind(AuthController)
);

// Email verification endpoints
router.post('/verify-email',
  authLimiter, // 5 requests per 15 minutes
  validate(verifyEmailSchema),
  AuthController.verifyEmail.bind(AuthController)
);

router.post('/resend-verification',
  strictLimiter, // 3 requests per hour
  validate(resendVerificationSchema),
  AuthController.resendVerificationEmail.bind(AuthController)
);

// CSRF token generation
router.get('/csrf-token',
  authenticate,
  generateCSRFToken
);

// Protected routes
router.post('/logout',
  authenticate,
  AuthController.logout.bind(AuthController)
);

router.get('/profile',
  authenticate,
  authorize(PERMISSIONS.PROFILE_READ), // User must have profile:read permission
  AuthController.getProfile.bind(AuthController)
);

// Change password endpoint for authenticated users
router.post('/change-password',
  authenticate,
  authLimiter, // 5 requests per 15 minutes
  validate(changePasswordSchema),
  AuthController.changePassword.bind(AuthController)
);

router.get('/verification-status',
  authenticate,
  AuthController.checkVerificationStatus.bind(AuthController)
);

// Google OAuth routes
router.get('/google',
  AuthController.googleAuth.bind(AuthController)
);

router.get('/google/callback',
  AuthController.googleCallback.bind(AuthController)
);

router.post('/google/link',
  authenticate,
  AuthController.linkGoogleAccount.bind(AuthController)
);

router.delete('/google/link',
  authenticate,
  AuthController.unlinkGoogleAccount.bind(AuthController)
);

router.get('/linked-providers',
  authenticate,
  AuthController.getLinkedProviders.bind(AuthController)
);

export default router;