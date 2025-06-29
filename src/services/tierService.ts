import { supabase } from '../config/database';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

export interface UserTier {
  id: string;
  tier_level: number;
  name: string;
  display_name: string;
  description: string;
  kyc_required: boolean;
  yearly_spending_threshold: number | null;
  max_cards: number | null;
  card_creation_fee: number;
  card_monthly_fee: number;
  daily_spending_limit: number | null;
  monthly_spending_limit: number | null;
  yearly_spending_limit: number | null;
  deposit_fee_percentage: number;
  withdrawal_fee_percentage: number;
  is_active: boolean;
  features: Record<string, any>;
}

export interface TierInfo {
  user_id: string;
  email: string;
  tier_id: string;
  tier_level: number;
  tier_name: string;
  tier_display_name: string;
  card_creation_fee: number;
  card_monthly_fee: number;
  deposit_fee_percentage: number;
  max_cards: number | null;
  daily_spending_limit: number | null;
  monthly_spending_limit: number | null;
  cards_created: number;
  can_create_card: boolean;
  next_tier_name: string | null;
  next_tier_threshold: number | null;
  next_tier_requirement: string;
  yearly_spending: number;
}

export interface TierChangeResult {
  user_id: string;
  previous_tier_id: string | null;
  new_tier_id: string;
  changed: boolean;
}

class TierService {
  /**
   * Get all active tiers
   */
  async getAllTiers(): Promise<UserTier[]> {
    try {
      const { data, error } = await supabase
        .from('user_tiers')
        .select('*')
        .eq('is_active', true)
        .order('tier_level', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching tiers:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to fetch tiers');
    }
  }

  /**
   * Get tier by ID
   */
  async getTierById(tierId: string): Promise<UserTier | null> {
    try {
      const { data, error } = await supabase
        .from('user_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching tier:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to fetch tier');
    }
  }

  /**
   * Get tier by level
   */
  async getTierByLevel(level: number): Promise<UserTier | null> {
    try {
      const { data, error } = await supabase
        .from('user_tiers')
        .select('*')
        .eq('tier_level', level)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching tier by level:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to fetch tier');
    }
  }

  /**
   * Get user's current tier information
   */
  async getUserTierInfo(userId: string): Promise<TierInfo | null> {
    try {
      const { data, error } = await supabase
        .from('user_tier_info')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching user tier info:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to fetch user tier information');
    }
  }

  /**
   * Calculate user's yearly spending
   */
  async calculateYearlySpending(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('calculate_user_yearly_spending', { p_user_id: userId });

      if (error) throw error;
      return data || 0;
    } catch (error) {
      logger.error('Error calculating yearly spending:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to calculate yearly spending');
    }
  }

  /**
   * Check and update user's tier based on KYC and spending
   */
  async checkAndUpdateUserTier(userId: string, reason: string = 'auto'): Promise<TierChangeResult> {
    try {
      const { data, error } = await supabase
        .rpc('assign_user_tier', { 
          p_user_id: userId,
          p_reason: reason 
        });

      if (error) throw error;
      
      logger.info('Tier check result:', {
        userId,
        result: data,
        reason
      });

      return data;
    } catch (error) {
      logger.error('Error updating user tier:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to update user tier');
    }
  }

  /**
   * Get user's tier history
   */
  async getUserTierHistory(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('user_tier_history')
        .select(`
          *,
          from_tier:user_tiers!from_tier_id(display_name, tier_level),
          to_tier:user_tiers!to_tier_id(display_name, tier_level)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching tier history:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to fetch tier history');
    }
  }

  /**
   * Check if user can create a new card based on tier limits
   */
  async canUserCreateCard(userId: string): Promise<{ allowed: boolean; reason?: string }> {
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
    } catch (error) {
      logger.error('Error checking card creation permission:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to check card creation permission');
    }
  }

  /**
   * Check spending limit for a transaction
   */
  async checkSpendingLimit(
    userId: string, 
    amount: number, 
    period: 'daily' | 'monthly' | 'yearly' = 'daily'
  ): Promise<{ allowed: boolean; limit?: number; current?: number; reason?: string }> {
    try {
      const tierInfo = await this.getUserTierInfo(userId);
      
      if (!tierInfo) {
        return { allowed: false, reason: 'User tier not found' };
      }

      // Get the appropriate limit
      let limit: number | null = null;
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
    } catch (error) {
      logger.error('Error checking spending limit:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to check spending limit');
    }
  }

  /**
   * Get user's spending for a specific period
   */
  private async getUserSpendingForPeriod(
    userId: string, 
    period: 'daily' | 'monthly' | 'yearly'
  ): Promise<number> {
    try {
      let startDate: Date;
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

      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .in('type', ['authorization', 'capture'])
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const total = data?.reduce((sum, tx) => sum + parseFloat(tx.amount), 0) || 0;
      return total;
    } catch (error) {
      logger.error('Error calculating period spending:', error);
      return 0; // Safe default
    }
  }

  /**
   * Get tier benefits/features
   */
  async getTierFeatures(tierId: string): Promise<Record<string, any>> {
    try {
      const tier = await this.getTierById(tierId);
      return tier?.features || {};
    } catch (error) {
      logger.error('Error fetching tier features:', error);
      return {};
    }
  }

  /**
   * Calculate fees for a user based on their tier
   */
  async calculateUserFees(userId: string): Promise<{
    cardCreationFee: number;
    cardMonthlyFee: number;
    depositFeePercentage: number;
    withdrawalFeePercentage: number;
  }> {
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
    } catch (error) {
      logger.error('Error calculating user fees:', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to calculate fees');
    }
  }
}

export default new TierService();