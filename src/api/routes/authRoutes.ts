import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/authValidators';
import { authLimiter } from '../middlewares/rateLimiter';
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
router.post('/logout',
  authenticate,
  AuthController.logout.bind(AuthController)
);

router.get('/profile',
  authenticate,
  authorize(PERMISSIONS.PROFILE_READ), // User must have profile:read permission
  AuthController.getProfile.bind(AuthController)
);

export default router;