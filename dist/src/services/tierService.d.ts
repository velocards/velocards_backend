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
declare class TierService {
    /**
     * Get all active tiers
     */
    getAllTiers(): Promise<UserTier[]>;
    /**
     * Get tier by ID
     */
    getTierById(tierId: string): Promise<UserTier | null>;
    /**
     * Get tier by level
     */
    getTierByLevel(level: number): Promise<UserTier | null>;
    /**
     * Get user's current tier information
     */
    getUserTierInfo(userId: string): Promise<TierInfo | null>;
    /**
     * Calculate user's yearly spending
     */
    calculateYearlySpending(userId: string): Promise<number>;
    /**
     * Check and update user's tier based on KYC and spending
     */
    checkAndUpdateUserTier(userId: string, reason?: string): Promise<TierChangeResult>;
    /**
     * Get user's tier history
     */
    getUserTierHistory(userId: string, limit?: number): Promise<any[]>;
    /**
     * Check if user can create a new card based on tier limits
     */
    canUserCreateCard(userId: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    /**
     * Check spending limit for a transaction
     */
    checkSpendingLimit(userId: string, amount: number, period?: 'daily' | 'monthly' | 'yearly'): Promise<{
        allowed: boolean;
        limit?: number;
        current?: number;
        reason?: string;
    }>;
    /**
     * Get user's spending for a specific period
     */
    private getUserSpendingForPeriod;
    /**
     * Get tier benefits/features
     */
    getTierFeatures(tierId: string): Promise<Record<string, any>>;
    /**
     * Calculate fees for a user based on their tier
     */
    calculateUserFees(userId: string): Promise<{
        cardCreationFee: number;
        cardMonthlyFee: number;
        depositFeePercentage: number;
        withdrawalFeePercentage: number;
    }>;
}
declare const _default: TierService;
export default _default;
//# sourceMappingURL=tierService.d.ts.map