"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TierController = void 0;
const tierService_1 = __importDefault(require("../../services/tierService"));
const pricingService_1 = __importDefault(require("../../services/pricingService"));
const responseFormatter_1 = require("../../utils/responseFormatter");
class TierController {
    /**
     * Get all available tiers
     */
    static async getAllTiers(_req, res, next) {
        try {
            const tiers = await tierService_1.default.getAllTiers();
            (0, responseFormatter_1.sendSuccess)(res, tiers);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get current user's tier information
     */
    static async getUserTier(req, res, next) {
        try {
            const userId = req.user.sub;
            const tierInfo = await tierService_1.default.getUserTierInfo(userId);
            if (!tierInfo) {
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'TIER_NOT_FOUND',
                        message: 'User tier information not found'
                    }
                });
                return;
            }
            (0, responseFormatter_1.sendSuccess)(res, tierInfo);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's tier history
     */
    static async getUserTierHistory(req, res, next) {
        try {
            const userId = req.user.sub;
            const limit = parseInt(req.query['limit']) || 10;
            const history = await tierService_1.default.getUserTierHistory(userId, limit);
            (0, responseFormatter_1.sendSuccess)(res, history);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's fee summary
     */
    static async getUserFees(req, res, next) {
        try {
            const userId = req.user.sub;
            const feeSummary = await pricingService_1.default.getUserFeeSummary(userId);
            (0, responseFormatter_1.sendSuccess)(res, feeSummary);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Calculate fees for a specific action
     */
    static async calculateFees(req, res, next) {
        try {
            const userId = req.user.sub;
            const { action, amount } = req.body;
            let result;
            switch (action) {
                case 'card_creation':
                    result = await pricingService_1.default.calculateCardCreationFee(userId);
                    break;
                case 'deposit':
                    if (!amount) {
                        res.status(400).json({
                            success: false,
                            error: {
                                code: 'MISSING_AMOUNT',
                                message: 'Amount is required for deposit fee calculation'
                            }
                        });
                        return;
                    }
                    result = await pricingService_1.default.calculateDepositFee(userId, amount);
                    break;
                case 'withdrawal':
                    if (!amount) {
                        res.status(400).json({
                            success: false,
                            error: {
                                code: 'MISSING_AMOUNT',
                                message: 'Amount is required for withdrawal fee calculation'
                            }
                        });
                        return;
                    }
                    result = await pricingService_1.default.calculateWithdrawalFee(userId, amount);
                    break;
                default:
                    res.status(400).json({
                        success: false,
                        error: {
                            code: 'INVALID_ACTION',
                            message: 'Invalid action. Supported actions: card_creation, deposit, withdrawal'
                        }
                    });
                    return;
            }
            (0, responseFormatter_1.sendSuccess)(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Process pending monthly fees
     */
    static async processMonthlyFees(req, res, next) {
        try {
            const userId = req.user.sub;
            const result = await pricingService_1.default.processPendingMonthlyFees(userId);
            (0, responseFormatter_1.sendSuccess)(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get upcoming monthly renewal information
     */
    static async getUpcomingRenewal(req, res, next) {
        try {
            const userId = req.user.sub;
            const renewalInfo = await pricingService_1.default.getUpcomingRenewal(userId);
            (0, responseFormatter_1.sendSuccess)(res, renewalInfo);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get detailed monthly fee breakdown
     */
    static async getMonthlyFeeBreakdown(req, res, next) {
        try {
            const userId = req.user.sub;
            const breakdown = await pricingService_1.default.getMonthlyFeeBreakdown(userId);
            (0, responseFormatter_1.sendSuccess)(res, breakdown);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.TierController = TierController;
//# sourceMappingURL=tierController.js.map