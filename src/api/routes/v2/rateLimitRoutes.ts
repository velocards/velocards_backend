import { Router } from 'express';
import { SecurityMonitoringController } from '../../controllers/security/monitoringController';
import { authenticate } from '../../middlewares/auth';

const router = Router();

// Rate limit status endpoint (requires authentication)
router.get(
  '/status',
  authenticate,
  SecurityMonitoringController.getRateLimitStatus as any
);

export default router;