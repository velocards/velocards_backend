import { Router } from 'express';
import { TierController } from '../controllers/tierController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { calculateFeesSchema } from '../validators/tierValidators';

const router = Router();

/**
 * @route GET /api/v1/tiers
 * @desc Get all available tiers
 * @access Public
 */
router.get('/', TierController.getAllTiers);

/**
 * @route GET /api/v1/tiers/current
 * @desc Get current user's tier information
 * @access Private
 */
router.get('/current', authenticate, TierController.getUserTier);

/**
 * @route GET /api/v1/tiers/history
 * @desc Get user's tier change history
 * @access Private
 */
router.get('/history', authenticate, TierController.getUserTierHistory);

/**
 * @route GET /api/v1/tiers/fees
 * @desc Get user's fee summary
 * @access Private
 */
router.get('/fees', authenticate, TierController.getUserFees);

/**
 * @route POST /api/v1/tiers/calculate-fees
 * @desc Calculate fees for a specific action
 * @access Private
 */
router.post('/calculate-fees', authenticate, validate(calculateFeesSchema), TierController.calculateFees);

/**
 * @route POST /api/v1/tiers/process-monthly-fees
 * @desc Process pending monthly fees for the user
 * @access Private
 */
router.post('/process-monthly-fees', authenticate, TierController.processMonthlyFees);

export default router;