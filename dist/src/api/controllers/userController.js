"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const userService_1 = require("../../services/userService");
const responseFormatter_1 = require("../../utils/responseFormatter");
const errors_1 = require("../../utils/errors");
const logger_1 = __importDefault(require("../../utils/logger"));
class UserController {
    /**
     * Get authenticated user's profile
     */
    static async getProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const profile = await userService_1.UserService.getUserProfile(userId);
            if (!profile) {
                throw new errors_1.NotFoundError('User profile not found');
            }
            (0, responseFormatter_1.sendSuccess)(res, profile);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update authenticated user's profile
     */
    static async updateProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const updateData = req.body;
            logger_1.default.info('Updating user profile', {
                userId,
                fields: Object.keys(updateData)
            });
            const updatedProfile = await userService_1.UserService.updateUserProfile(userId, updateData);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Profile updated successfully',
                profile: updatedProfile
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's current balance
     */
    static async getBalance(req, res, next) {
        try {
            const userId = req.user.id;
            const balance = await userService_1.UserService.getUserBalance(userId);
            (0, responseFormatter_1.sendSuccess)(res, {
                balance: balance.virtual_balance,
                currency: 'USD',
                lastUpdated: balance.updated_at
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's available balance with breakdown
     */
    static async getAvailableBalance(req, res, next) {
        try {
            const userId = req.user.id;
            const balanceInfo = await userService_1.UserService.getUserAvailableBalance(userId);
            (0, responseFormatter_1.sendSuccess)(res, balanceInfo);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's balance history
     */
    static async getBalanceHistory(req, res, next) {
        try {
            const userId = req.user.id;
            const { page = 1, limit = 20, from, to, type = 'all', sortBy = 'created_at', sortOrder = 'desc' } = req.query;
            logger_1.default.info('Fetching balance history', {
                userId,
                page,
                limit,
                type
            });
            const historyParams = {
                page: Number(page),
                limit: Number(limit),
                type: type,
                sortBy: sortBy,
                sortOrder: sortOrder
            };
            if (from)
                historyParams.from = new Date(from);
            if (to)
                historyParams.to = new Date(to);
            const history = await userService_1.UserService.getBalanceHistory(userId, historyParams);
            (0, responseFormatter_1.sendSuccess)(res, {
                transactions: history.transactions,
                pagination: {
                    page: history.page,
                    limit: history.limit,
                    total: history.total,
                    totalPages: history.totalPages
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update user settings
     */
    static async updateSettings(req, res, next) {
        try {
            const userId = req.user.id;
            const settings = req.body;
            logger_1.default.info('Updating user settings', {
                userId,
                settingTypes: Object.keys(settings)
            });
            const updatedSettings = await userService_1.UserService.updateUserSettings(userId, settings);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Settings updated successfully',
                settings: updatedSettings
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=userController.js.map