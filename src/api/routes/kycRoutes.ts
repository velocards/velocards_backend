import { Router } from 'express';
import { KYCController } from '../controllers/kycController';
import { authenticate } from '../middlewares/auth';
import { authLimiter, defaultLimiter } from '../middlewares/rateLimiter';
import { validate } from '../middlewares/validate';
import { initiateKYCSchema, resetKYCSchema, kycWebhookSchema } from '../validators/kycValidators';

const router = Router();

// Public webhook endpoint (no auth required)
router.post(
  '/webhook',
  defaultLimiter,
  validate(kycWebhookSchema),
  KYCController.processWebhook
);

// Authenticated endpoints
router.use(authenticate);

// Initiate KYC verification
router.post(
  '/initiate',
  authLimiter,
  validate(initiateKYCSchema),
  KYCController.initiateKYC
);

// Get KYC status
router.get(
  '/status',
  defaultLimiter,
  KYCController.getKYCStatus
);

// Reset KYC for retry
router.post(
  '/reset',
  authLimiter,
  validate(resetKYCSchema),
  KYCController.resetKYC
);

export default router;