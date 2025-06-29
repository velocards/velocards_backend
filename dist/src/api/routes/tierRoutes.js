"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tierController_1 = require("../controllers/tierController");
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const tierValidators_1 = require("../validators/tierValidators");
const router = (0, express_1.Router)();
/**
 * @route GET /api/v1/tiers
 * @desc Get all available tiers
 * @access Public
 */
router.get('/', tierController_1.TierController.getAllTiers);
/**
 * @route GET /api/v1/tiers/current
 * @desc Get current user's tier information
 * @access Private
 */
router.get('/current', auth_1.authenticate, tierController_1.TierController.getUserTier);
/**
 * @route GET /api/v1/tiers/history
 * @desc Get user's tier change history
 * @access Private
 */
router.get('/history', auth_1.authenticate, tierController_1.TierController.getUserTierHistory);
/**
 * @route GET /api/v1/tiers/fees
 * @desc Get user's fee summary
 * @access Private
 */
router.get('/fees', auth_1.authenticate, tierController_1.TierController.getUserFees);
/**
 * @route POST /api/v1/tiers/calculate-fees
 * @desc Calculate fees for a specific action
 * @access Private
 */
router.post('/calculate-fees', auth_1.authenticate, (0, validate_1.validate)(tierValidators_1.calculateFeesSchema), tierController_1.TierController.calculateFees);
/**
 * @route POST /api/v1/tiers/process-monthly-fees
 * @desc Process pending monthly fees for the user
 * @access Private
 */
router.post('/process-monthly-fees', auth_1.authenticate, tierController_1.TierController.processMonthlyFees);
/**
 * @route GET /api/v1/tiers/upcoming-renewal
 * @desc Get upcoming monthly renewal information
 * @access Private
 */
router.get('/upcoming-renewal', auth_1.authenticate, tierController_1.TierController.getUpcomingRenewal);
/**
 * @route GET /api/v1/tiers/monthly-fee-breakdown
 * @desc Get detailed monthly fee breakdown
 * @access Private
 */
router.get('/monthly-fee-breakdown', auth_1.authenticate, tierController_1.TierController.getMonthlyFeeBreakdown);
exports.default = router;
//# sourceMappingURL=tierRoutes.js.map