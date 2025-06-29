import { supabase } from '../config/database';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import tierService from './tierService';
import { UserRepository } from '../repositories/userRepository';

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

class PricingService {
  /**
   * Calculate card creation fee for a user
   */
  async calculateCardCreationFee(userId: string): Promise<CardFees> {
    try {
      const tierInfo = await tierService.getUserTierInfo(userId);
      
      if (!tierInfo) {
        throw new AppError('USER_NOT_FOUND', 'User tier information not found');
      }

      return {
        creationFee: tierInfo.card_creation_fee,
        monthlyFee: tierInfo.card_monthly_fee,
        tierName: tierInfo.tier_display_name,
        tierLevel: tierInfo.tier_level
      };
    } catch (error) {
      logger.error('Error calculating card creation fee:', error);
      throw error;
    }
  }

  /**
   * Calculate deposit fee based on user's tier
   */
  async calculateDepositFee(userId: string, depositAmount: number): Promise<FeeCalculation> {
    try {
      const fees = await tierService.calculateUserFees(userId);
      const feeAmount = (depositAmount * fees.depositFeePercentage) / 100;
      const netAmount = depositAmount - feeAmount;

      return {
        baseFee: 0, // No base fee for deposits
        feePercentage: fees.depositFeePercentage,
        calculatedFee: parseFloat(feeAmount.toFixed(2)),
        totalAmount: parseFloat(netAmount.toFixed(2)),
        description: `Deposit fee (${fees.depositFeePercentage}%)`
      };
    } catch (error) {
      logger.error('Error calculating deposit fee:', error);
      throw error;
    }
  }

  /**
   * Calculate withdrawal fee based on user's tier
   */
  async calculateWithdrawalFee(userId: string, withdrawalAmount: number): Promise<FeeCalculation> {
    try {
      const fees = await tierService.calculateUserFees(userId);
      const feeAmount = (withdrawalAmount * fees.withdrawalFeePercentage) / 100;
      const totalAmount = withdrawalAmount + feeAmount;

      return {
        baseFee: 0,
        feePercentage: fees.withdrawalFeePercentage,
        calculatedFee: parseFloat(feeAmount.toFixed(2)),
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        description: `Withdrawal fee (${fees.withdrawalFeePercentage}%)`
      };
    } catch (error) {
      logger.error('Error calculating withdrawal fee:', error);
      throw error;
    }
  }

  /**
   * Apply card creation fee to user's balance
   */
  async applyCardCreationFee(userId: string): Promise<{
    feeApplied: number;
    newBalance: number;
    ledgerEntryId: string;
  }> {
    try {
      // Get user's current balance
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found');
      }

      // Calculate the fee
      const cardFees = await this.calculateCardCreationFee(userId);
      
      // Check if user has sufficient balance
      if (user.virtual_balance < cardFees.creationFee) {
        throw new AppError(
          'INSUFFICIENT_BALANCE',
          `Insufficient balance for card creation fee. Required: $${cardFees.creationFee}, Available: $${user.virtual_balance}`
        );
      }

      // Deduct the fee
      const updatedUser = await UserRepository.adjustBalance(
        userId,
        cardFees.creationFee,
        'subtract'
      );

      // Create ledger entry
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from('user_balance_ledger')
        .insert({
          user_id: userId,
          transaction_type: 'card_creation_fee',
          amount: cardFees.creationFee,
          balance_before: user.virtual_balance,
          balance_after: updatedUser.virtual_balance,
          reference_type: 'card_creation',
          description: `Card creation fee - ${cardFees.tierName} tier`,
          metadata: {
            tier_level: cardFees.tierLevel,
            tier_name: cardFees.tierName,
            fee_amount: cardFees.creationFee
          }
        })
        .select()
        .single();

      if (ledgerError) {
        logger.error('Error creating ledger entry:', ledgerError);
      }

      return {
        feeApplied: cardFees.creationFee,
        newBalance: updatedUser.virtual_balance,
        ledgerEntryId: ledgerEntry?.id || ''
      };
    } catch (error) {
      logger.error('Error applying card creation fee:', error);
      throw error;
    }
  }

  /**
   * Apply deposit fee to the deposit amount
   */
  async applyDepositFee(userId: string, depositAmount: number): Promise<{
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    feePercentage: number;
  }> {
    try {
      const feeCalculation = await this.calculateDepositFee(userId, depositAmount);

      return {
        grossAmount: depositAmount,
        feeAmount: feeCalculation.calculatedFee,
        netAmount: feeCalculation.totalAmount,
        feePercentage: feeCalculation.feePercentage
      };
    } catch (error) {
      logger.error('Error applying deposit fee:', error);
      throw error;
    }
  }

  /**
   * Schedule monthly card fees for a card
   */
  async scheduleMonthlyCardFee(cardId: string, userId: string): Promise<void> {
    try {
      const cardFees = await this.calculateCardCreationFee(userId);
      
      // Only schedule if monthly fee is greater than 0
      if (cardFees.monthlyFee <= 0) {
        return;
      }

      // Calculate next billing date (first day of next month)
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 5); // 5th of next month

      // Check if fee already scheduled for this period
      const { data: existingFee } = await supabase
        .from('card_monthly_fees')
        .select('id')
        .eq('card_id', cardId)
        .eq('billing_month', nextMonth.toISOString().split('T')[0])
        .single();

      if (existingFee) {
        return; // Fee already scheduled
      }

      // Create monthly fee record
      const { error } = await supabase
        .from('card_monthly_fees')
        .insert({
          card_id: cardId,
          user_id: userId,
          fee_amount: cardFees.monthlyFee,
          fee_status: 'pending',
          billing_month: nextMonth.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          tier_id: (await tierService.getUserTierInfo(userId))?.tier_id,
          base_fee: cardFees.monthlyFee
        });

      if (error) {
        logger.error('Error scheduling monthly fee:', error);
      }
    } catch (error) {
      logger.error('Error in scheduleMonthlyCardFee:', error);
    }
  }

  /**
   * Process pending monthly fees for a user
   */
  async processPendingMonthlyFees(userId: string): Promise<{
    processed: number;
    failed: number;
    totalAmount: number;
  }> {
    try {
      // Get all pending fees
      const { data: pendingFees, error } = await supabase
        .from('card_monthly_fees')
        .select('*')
        .eq('user_id', userId)
        .eq('fee_status', 'pending')
        .lte('due_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      let processed = 0;
      let failed = 0;
      let totalAmount = 0;

      for (const fee of pendingFees || []) {
        try {
          // Check user balance
          const user = await UserRepository.findById(userId);
          if (!user || user.virtual_balance < fee.fee_amount) {
            // Mark as failed
            await supabase
              .from('card_monthly_fees')
              .update({ 
                fee_status: 'failed',
                updated_at: new Date().toISOString()
              })
              .eq('id', fee.id);
            
            failed++;
            continue;
          }

          // Deduct fee
          const updatedUser = await UserRepository.adjustBalance(
            userId,
            fee.fee_amount,
            'subtract'
          );

          if (updatedUser) {
            // Create ledger entry
            const { data: ledgerEntry } = await supabase
              .from('user_balance_ledger')
              .insert({
                user_id: userId,
                transaction_type: 'card_monthly_fee',
                amount: fee.fee_amount,
                balance_before: user.virtual_balance,
                balance_after: updatedUser.virtual_balance,
                reference_type: 'monthly_fee',
                reference_id: fee.card_id,
                description: `Monthly card fee - ${new Date(fee.billing_month).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`
              })
              .select()
              .single();

            // Update fee status
            await supabase
              .from('card_monthly_fees')
              .update({ 
                fee_status: 'charged',
                charged_at: new Date().toISOString(),
                balance_ledger_id: ledgerEntry?.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', fee.id);

            processed++;
            totalAmount += fee.fee_amount;
          } else {
            failed++;
          }
        } catch (err) {
          logger.error('Error processing individual fee:', err);
          failed++;
        }
      }

      return { processed, failed, totalAmount };
    } catch (error) {
      logger.error('Error processing monthly fees:', error);
      throw error;
    }
  }

  /**
   * Get fee summary for a user
   */
  async getUserFeeSummary(userId: string): Promise<{
    currentTier: string;
    fees: {
      cardCreation: number;
      cardMonthly: number;
      depositPercentage: number;
      withdrawalPercentage: number;
    };
    monthlyFeesOwed: number;
    totalFeesThisMonth: number;
  }> {
    try {
      const tierInfo = await tierService.getUserTierInfo(userId);
      const fees = await tierService.calculateUserFees(userId);

      // Get pending monthly fees
      const { data: pendingFees } = await supabase
        .from('card_monthly_fees')
        .select('fee_amount')
        .eq('user_id', userId)
        .eq('fee_status', 'pending');

      const monthlyFeesOwed = pendingFees?.reduce((sum, fee) => sum + fee.fee_amount, 0) || 0;

      // Get fees paid this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: thisMonthFees } = await supabase
        .from('user_balance_ledger')
        .select('amount')
        .eq('user_id', userId)
        .in('transaction_type', ['card_creation_fee', 'card_monthly_fee', 'deposit_fee'])
        .gte('created_at', startOfMonth.toISOString());

      const totalFeesThisMonth = thisMonthFees?.reduce((sum, entry) => sum + entry.amount, 0) || 0;

      return {
        currentTier: tierInfo?.tier_display_name || 'Unverified',
        fees: {
          cardCreation: fees.cardCreationFee,
          cardMonthly: fees.cardMonthlyFee,
          depositPercentage: fees.depositFeePercentage,
          withdrawalPercentage: fees.withdrawalFeePercentage
        },
        monthlyFeesOwed,
        totalFeesThisMonth
      };
    } catch (error) {
      logger.error('Error getting fee summary:', error);
      throw error;
    }
  }
}

export default new PricingService();