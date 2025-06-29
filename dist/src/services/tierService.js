"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
class TierService {
    /**
     * Get all active tiers
     */
    async getAllTiers() {
        try {
            const { data, error } = await database_1.supabase
                .from('user_tiers')
                .select('*')
                .eq('is_active', true)
                .order('tier_level', { ascending: true });
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error fetching tiers:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to fetch tiers');
        }
    }
    /**
     * Get tier by ID
     */
    async getTierById(tierId) {
        try {
            const { data, error } = await database_1.supabase
                .from('user_tiers')
                .select('*')
                .eq('id', tierId)
                .single();
            if (error && error.code !== 'PGRST116')
                throw error;
            return data;
        }
        catch (error) {
            logger_1.default.error('Error fetching tier:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to fetch tier');
        }
    }
    /**
     * Get tier by level
     */
    async getTierByLevel(level) {
        try {
            const { data, error } = await database_1.supabase
                .from('user_tiers')
                .select('*')
                .eq('tier_level', level)
                .eq('is_active', true)
                .single();
            if (error && error.code !== 'PGRST116')
                throw error;
            return data;
        }
        catch (error) {
            logger_1.default.error('Error fetching tier by level:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to fetch tier');
        }
    }
    /**
     * Get user's current tier information
     */
    async getUserTierInfo(userId) {
        try {
            const { data, error } = await database_1.supabase
                .from('user_tier_info')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error && error.code !== 'PGRST116')
                throw error;
            return data;
        }
        catch (error) {
            logger_1.default.error('Error fetching user tier info:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to fetch user tier information');
        }
    }
    /**
     * Calculate user's yearly spending
     */
    async calculateYearlySpending(userId) {
        try {
            const { data, error } = await database_1.supabase
                .rpc('calculate_user_yearly_spending', { p_user_id: userId });
            if (error)
                throw error;
            return data || 0;
        }
        catch (error) {
            logger_1.default.error('Error calculating yearly spending:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to calculate yearly spending');
        }
    }
    /**
     * Check and update user's tier based on KYC and spending
     */
    async checkAndUpdateUserTier(userId, reason = 'auto') {
        try {
            const { data, error } = await database_1.supabase
                .rpc('assign_user_tier', {
                p_user_id: userId,
                p_reason: reason
            });
            if (error)
                throw error;
            logger_1.default.info('Tier check result:', {
                userId,
                result: data,
                reason
            });
            return data;
        }
        catch (error) {
            logger_1.default.error('Error updating user tier:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to update user tier');
        }
    }
    /**
     * Get user's tier history
     */
    async getUserTierHistory(userId, limit = 10) {
        try {
            const { data, error } = await database_1.supabase
                .from('user_tier_history')
                .select(`
          *,
          from_tier:user_tiers!from_tier_id(display_name, tier_level),
          to_tier:user_tiers!to_tier_id(display_name, tier_level)
        `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error fetching tier history:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to fetch tier history');
        }
    }
    /**
     * Check if user can create a new card based on tier limits
     */
    async canUserCreateCard(userId) {
        try {
            const tierInfo = await this.getUserTierInfo(userId);
            if (!tierInfo) {
                return { allowed: false, reason: 'User tier not found' };
            }
            if (!tierInfo.can_create_card) {
                if (tierInfo.max_cards !== null && tierInfo.cards_created >= tierInfo.max_cards) {
                    return {
                        allowed: false,
                        reason: `Maximum cards limit (${tierInfo.max_cards}) reached for ${tierInfo.tier_display_name} tier`
                    };
                }
                return { allowed: false, reason: 'Card creation not allowed' };
            }
            return { allowed: true };
        }
        catch (error) {
            logger_1.default.error('Error checking card creation permission:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to check card creation permission');
        }
    }
    /**
     * Check spending limit for a transaction
     */
    async checkSpendingLimit(userId, amount, period = 'daily') {
        try {
            const tierInfo = await this.getUserTierInfo(userId);
            if (!tierInfo) {
                return { allowed: false, reason: 'User tier not found' };
            }
            // Get the appropriate limit
            let limit = null;
            switch (period) {
                case 'daily':
                    limit = tierInfo.daily_spending_limit;
                    break;
                case 'monthly':
                    limit = tierInfo.monthly_spending_limit;
                    break;
                case 'yearly':
                    // For yearly, we'll use no limit since it's not in the tier structure
                    limit = null;
                    break;
            }
            // No limit means unlimited spending
            if (limit === null) {
                return { allowed: true };
            }
            // Get current spending for the period
            const currentSpending = await this.getUserSpendingForPeriod(userId, period);
            if (currentSpending + amount > limit) {
                return {
                    allowed: false,
                    limit,
                    current: currentSpending,
                    reason: `Would exceed ${period} spending limit of $${limit.toFixed(2)}`
                };
            }
            return { allowed: true, limit, current: currentSpending };
        }
        catch (error) {
            logger_1.default.error('Error checking spending limit:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to check spending limit');
        }
    }
    /**
     * Get user's spending for a specific period
     */
    async getUserSpendingForPeriod(userId, period) {
        try {
            let startDate;
            const now = new Date();
            switch (period) {
                case 'daily':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'monthly':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'yearly':
                    startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                    break;
            }
            const { data, error } = await database_1.supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', userId)
                .eq('status', 'completed')
                .in('type', ['authorization', 'capture'])
                .gte('created_at', startDate.toISOString());
            if (error)
                throw error;
            const total = data?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
            return total;
        }
        catch (error) {
            logger_1.default.error('Error calculating period spending:', error);
            return 0; // Safe default
        }
    }
    /**
     * Get tier benefits/features
     */
    async getTierFeatures(tierId) {
        try {
            const tier = await this.getTierById(tierId);
            return tier?.features || {};
        }
        catch (error) {
            logger_1.default.error('Error fetching tier features:', error);
            return {};
        }
    }
    /**
     * Calculate fees for a user based on their tier
     */
    async calculateUserFees(userId) {
        try {
            const tierInfo = await this.getUserTierInfo(userId);
            if (!tierInfo) {
                // Default to tier 0 fees if no tier found
                const defaultTier = await this.getTierByLevel(0);
                return {
                    cardCreationFee: defaultTier?.card_creation_fee || 50,
                    cardMonthlyFee: defaultTier?.card_monthly_fee || 0,
                    depositFeePercentage: defaultTier?.deposit_fee_percentage || 5,
                    withdrawalFeePercentage: defaultTier?.withdrawal_fee_percentage || 5
                };
            }
            return {
                cardCreationFee: tierInfo.card_creation_fee,
                cardMonthlyFee: tierInfo.card_monthly_fee,
                depositFeePercentage: tierInfo.deposit_fee_percentage,
                withdrawalFeePercentage: tierInfo.deposit_fee_percentage // Using same as deposit for now
            };
        }
        catch (error) {
            logger_1.default.error('Error calculating user fees:', error);
            throw new errors_1.AppError('INTERNAL_ERROR', 'Failed to calculate fees');
        }
    }
}
exports.default = new TierService();
//# sourceMappingURL=tierService.js.map