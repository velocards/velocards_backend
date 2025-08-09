import { Router } from 'express';
import twoFactorRoutes from './auth/twoFactor';

const router = Router();

// Mount auth routes
router.use('/auth/2fa', twoFactorRoutes);

export default router;