import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { 
  updateProfileSchema, 
  updateSettingsSchema,
  balanceHistoryQuerySchema 
} from '../validators/userValidators';
import { PERMISSIONS } from '../../config/roles';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Profile routes
router.get(
  '/profile',
  authorize(PERMISSIONS.PROFILE_READ),
  UserController.getProfile
);

router.put(
  '/profile',
  authorize(PERMISSIONS.PROFILE_UPDATE),
  validate(updateProfileSchema),
  UserController.updateProfile
);

// Balance routes
router.get(
  '/balance',
  authorize(PERMISSIONS.BALANCE_READ),
  UserController.getBalance
);

router.get(
  '/balance/available',
  authorize(PERMISSIONS.BALANCE_READ),
  UserController.getAvailableBalance
);

router.get(
  '/balance/history',
  authorize(PERMISSIONS.BALANCE_READ),
  validate(balanceHistoryQuerySchema),
  UserController.getBalanceHistory
);

// Settings routes
router.put(
  '/settings',
  authorize(PERMISSIONS.SETTINGS_UPDATE),
  validate(updateSettingsSchema),
  UserController.updateSettings
);

// Statistics routes
router.get(
  '/statistics',
  authorize(PERMISSIONS.PROFILE_READ),
  UserController.getUserStatistics
);

export default router;