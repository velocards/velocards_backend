import { Router } from 'express';
// 2FA disabled - implementation incomplete
// import twoFactorRoutes from './auth/twoFactor';
import securityMonitoringRoutes from './security/monitoring';
import rateLimitRoutes from './rateLimitRoutes';

const router = Router();

// 2FA routes disabled - implementation incomplete
// router.use('/auth/2fa', twoFactorRoutes);

// Security monitoring routes
router.use('/security', securityMonitoringRoutes);

// Rate limit status routes
router.use('/rate-limit', rateLimitRoutes);

export default router;