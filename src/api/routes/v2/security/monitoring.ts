import { Router } from 'express';
import { SecurityMonitoringController } from '../../../controllers/security/monitoringController';
import { authenticate } from '../../../middlewares/auth';
import { authorize } from '../../../middlewares/authorize';
import { defaultLimiter } from '../../../middlewares/rateLimiter';
import { PERMISSIONS } from '../../../../config/roles';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply rate limiting
router.use(defaultLimiter);

// Audit logs endpoints
router.get(
  '/audit-logs',
  authorize([PERMISSIONS.SYSTEM_ADMIN]),
  SecurityMonitoringController.getAuditLogs as any
);

router.post(
  '/audit-logs/cleanup',
  authorize([PERMISSIONS.SYSTEM_ADMIN]),
  SecurityMonitoringController.cleanupAuditLogs as any
);

router.get(
  '/export',
  authorize([PERMISSIONS.SYSTEM_ADMIN]),
  SecurityMonitoringController.exportAuditLogs as any
);

// Metrics endpoint
router.get(
  '/metrics',
  authorize([PERMISSIONS.SYSTEM_ADMIN]),
  SecurityMonitoringController.getSecurityMetrics as any
);

// User activity endpoint
router.get(
  '/user-activity/:userId',
  SecurityMonitoringController.getUserActivity as any
);

// Anomaly configuration endpoint
router.post(
  '/anomaly-config',
  authorize([PERMISSIONS.SYSTEM_ADMIN]),
  SecurityMonitoringController.updateAnomalyConfig as any
);

export default router;