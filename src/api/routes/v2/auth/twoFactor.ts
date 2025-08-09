import { Router } from 'express';
import { TwoFactorController } from '../../../controllers/auth/twoFactorController';
import { authenticate } from '../../../middlewares/auth';
import { rateLimiter } from '../../../middlewares/rateLimiter';

const router = Router();
const twoFactorController = new TwoFactorController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Rate limiting for security-sensitive operations
const setupLimiter = rateLimiter.auth;
const verifyLimiter = rateLimiter.strict;

// 2FA Setup Routes
router.post('/setup', setupLimiter, (req, res) => twoFactorController.setup(req, res));
router.post('/enable', verifyLimiter, (req, res) => twoFactorController.enable(req, res));
router.get('/qrcode', (req, res) => twoFactorController.getQRCode(req, res));

// 2FA Verification Routes
router.post('/verify', verifyLimiter, (req, res) => twoFactorController.verify(req, res));

// 2FA Management Routes
router.post('/disable', setupLimiter, (req, res) => twoFactorController.disable(req, res));
router.get('/status', (req, res) => twoFactorController.getStatus(req, res));

// Backup Codes Routes
router.post('/backup-codes/verify', verifyLimiter, (req, res) => twoFactorController.verifyBackupCode(req, res));
router.post('/backup-codes/regenerate', setupLimiter, (req, res) => twoFactorController.regenerateBackupCodes(req, res));

// Account Recovery Routes (no auth required)
const recoveryRouter = Router();
recoveryRouter.post('/initiate', setupLimiter, (req, res) => twoFactorController.initiateRecovery(req, res));
recoveryRouter.post('/verify', verifyLimiter, (req, res) => twoFactorController.verifyRecovery(req, res));
recoveryRouter.post('/disable', verifyLimiter, (req, res) => twoFactorController.disableViaRecovery(req, res));

// Mount recovery routes without auth middleware
router.use('/recovery', recoveryRouter);

export default router;