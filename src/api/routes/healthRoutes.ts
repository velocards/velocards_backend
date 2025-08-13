import { Router } from 'express';
import { HealthController } from '../controllers/healthController';
import { authorize } from '../middlewares/authorize';
import { PERMISSIONS } from '../../config/roles';

const router = Router();

/**
 * Health check routes
 * Provides endpoints for monitoring system and configuration health
 */

// Public health check
router.get('/', HealthController.getHealth);

// Configuration health check (requires system admin permission)
router.get('/config', 
  authorize([PERMISSIONS.SYSTEM_ADMIN]), 
  HealthController.getConfigHealth
);

// Validate specific configuration category (requires system admin permission)
router.get('/config/category/:category', 
  authorize([PERMISSIONS.SYSTEM_ADMIN]), 
  HealthController.validateConfigCategory
);

// Get masked configuration (requires system admin permission)
router.get('/config/masked', 
  authorize([PERMISSIONS.SYSTEM_ADMIN]), 
  HealthController.getMaskedConfig
);

export default router;