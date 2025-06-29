export interface FeeCalculation {
    baseFee: number;
    feePercentage: number;
    calculatedFee: number;
    totalAmount: number;
    description: string;
}
export interface CardFees {
    creationFee: number;
    monthlyFee: number;
    tierName: string;
    tierLevel: number;
}
declare class PricingService {
    /**
     * Calculate card creation fee for a user
     */
    calculateCardCreationFee(userId: string): Promise<CardFees>;
    /**
     * Calculate deposit fee based on user's tier
     */
    calculateDepositFee(userId: string, depositAmount: number): Promise<FeeCalculation>;
    /**
     * Calculate withdrawal fee based on user's tier
     */
    calculateWithdrawalFee(userId: string, withdrawalAmount: number): Promise<FeeCalculation>;
    /**
     * Apply card creation fee to user's balance
     */
    applyCardCreationFee(userId: string): Promise<{
        feeApplied: number;
        newBalance: number;
        ledgerEntryId: string;
    }>;
    /**
     * Apply deposit fee to the deposit amount
     */
    applyDepositFee(userId: string, depositAmount: number): Promise<{
        grossAmount: number;
        feeAmount: number;
        netAmount: number;
        feePercentage: number;
    }>;
    /**
     * Schedule monthly card fees for a card
     */
    scheduleMonthlyCardFee(cardId: string, userId: string): Promise<void>;
    /**
     * Process pending monthly fees for a user
     */
    processPendingMonthlyFees(userId: string): Promise<{
        processed: number;
        failed: number;
        totalAmount: number;
    }>;
    /**
     * Get fee summary for a user
     */
    getUserFeeSummary(userId: string): Promise<{
        currentTier: string;
        fees: {
            cardCreation: number;
            cardMonthly: number;
            depositPercentage: number;
            withdrawalPercentage: number;
        };
        monthlyFeesOwed: number;
        totalFeesThisMonth: number;
    }>;
    /**
     * Get upcoming monthly renewal information
     */
    getUpcomingRenewal(userId: string): Promise<{
        nextRenewalDate: string;
        daysUntilRenewal: number;
        totalRenewalAmount: number;
        activeCardsCount: number;
        perCardFee: number;
        currentBalance: number;
        sufficientBalance: boolean;
        balanceShortfall: number;
        cardsAtRisk: Array<{
            cardId: string;
            cardToken: string;
            maskedPan: string;
            monthlyFee: number;
            currentBalance: number;
        }>;
    }>;
    /**
     * Get detailed monthly fee breakdown for a user
     */
    getMonthlyFeeBreakdown(userId: string): Promise<{
        currentMonth: {
            paid: number;
            pending: number;
            failed: number;
        };
        nextMonth: {
            scheduled: number;
            dueDate: string;
        };
        cardBreakdown: Array<{
            cardId: string;
            maskedPan: string;
            nickname?: string;
            monthlyFee: number;
            status: string;
            lastPaymentDate?: string;
            nextPaymentDue?: string;
        }>;
    }>;
}
declare const _default: PricingService;
export default _default;
//# sourceMappingURL=pricingService.d.ts.map