"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMonthlyFeeWorker = createMonthlyFeeWorker;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../../config/env");
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = __importDefault(require("../../config/database"));
const userRepository_1 = require("../../repositories/userRepository");
const cardRepository_1 = require("../../repositories/cardRepository");
/**
 * Process monthly fees for all users
 * This runs on the 1st of every month
 */
async function processAllUsersMonthlyFees() {
    const results = [];
    try {
        // Get all users with active cards
        const { data: usersWithCards, error } = await database_1.default
            .from('virtual_cards')
            .select('user_id')
            .eq('status', 'active')
            .gt('monthly_fee_amount', 0); // Only cards with monthly fees
        if (error)
            throw error;
        // Get unique user IDs
        const uniqueUserIds = [...new Set(usersWithCards?.map(c => c.user_id) || [])];
        logger_1.default.info(`Processing monthly fees for ${uniqueUserIds.length} users`);
        // Process each user
        for (const userId of uniqueUserIds) {
            try {
                const result = await processUserMonthlyFees(userId);
                results.push(result);
            }
            catch (error) {
                logger_1.default.error(`Failed to process monthly fees for user ${userId}:`, error);
                results.push({
                    userId,
                    processed: false,
                    feesCharged: 0,
                    cardsAffected: 0,
                    cardsDeactivated: 0,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        // Calculate summary
        const summary = {
            totalUsers: results.length,
            successfulUsers: results.filter(r => r.processed).length,
            failedUsers: results.filter(r => !r.processed).length,
            totalFeesCollected: results.reduce((sum, r) => sum + r.feesCharged, 0),
            totalCardsDeactivated: results.reduce((sum, r) => sum + r.cardsDeactivated, 0)
        };
        logger_1.default.info('Monthly fee processing completed:', summary);
        return summary;
    }
    catch (error) {
        logger_1.default.error('Failed to process monthly fees:', error);
        throw error;
    }
}
/**
 * Process monthly fees for a specific user
 */
async function processUserMonthlyFees(userId) {
    try {
        // Get user's active cards with monthly fees
        const activeCards = await cardRepository_1.CardRepository.findByUserId(userId);
        const cardsWithFees = activeCards.filter(card => card.status === 'active' && (card.monthly_fee_amount || 0) > 0);
        if (cardsWithFees.length === 0) {
            return {
                userId,
                processed: true,
                feesCharged: 0,
                cardsAffected: 0,
                cardsDeactivated: 0
            };
        }
        // Calculate total monthly fees needed
        const totalMonthlyFees = cardsWithFees.reduce((sum, card) => sum + (card.monthly_fee_amount || 0), 0);
        // Get user's current balance
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        let remainingFees = totalMonthlyFees;
        let feesCharged = 0;
        let cardsAffected = 0;
        let cardsDeactivated = 0;
        // Step 1: Try to deduct from user's virtual balance first
        if (user.virtual_balance > 0) {
            const deductAmount = Math.min(user.virtual_balance, remainingFees);
            // Deduct from user balance
            await userRepository_1.UserRepository.adjustBalance(userId, deductAmount, 'subtract');
            // Create ledger entry
            await database_1.default
                .from('user_balance_ledger')
                .insert({
                user_id: userId,
                transaction_type: 'card_monthly_fee',
                amount: deductAmount,
                balance_before: user.virtual_balance,
                balance_after: user.virtual_balance - deductAmount,
                reference_type: 'monthly_fee_bulk',
                description: `Monthly card fees for ${cardsWithFees.length} cards`,
                metadata: {
                    cards_count: cardsWithFees.length,
                    billing_month: new Date().toISOString().slice(0, 7)
                }
            });
            feesCharged += deductAmount;
            remainingFees -= deductAmount;
        }
        // Step 2: If still have remaining fees, deduct from card limits
        if (remainingFees > 0) {
            // Sort cards by remaining balance (ascending) to affect cards with lower balances first
            const sortedCards = [...cardsWithFees].sort((a, b) => (a.remaining_balance || 0) - (b.remaining_balance || 0));
            for (const card of sortedCards) {
                if (remainingFees <= 0)
                    break;
                const cardFee = card.monthly_fee_amount || 0;
                const cardBalance = card.remaining_balance || 0;
                if (cardBalance > 0) {
                    // Deduct from card's remaining balance
                    const deductAmount = Math.min(cardBalance, Math.min(cardFee, remainingFees));
                    await cardRepository_1.CardRepository.update(card.id, {
                        remaining_balance: cardBalance - deductAmount,
                        spent_amount: (card.spent_amount || 0) + deductAmount,
                        metadata: {
                            ...card.metadata,
                            last_monthly_fee_deduction: {
                                amount: deductAmount,
                                date: new Date().toISOString(),
                                from: 'card_balance'
                            }
                        }
                    });
                    // Create transaction record
                    await database_1.default
                        .from('transactions')
                        .insert({
                        user_id: userId,
                        card_id: card.id,
                        type: 'capture',
                        amount: deductAmount,
                        currency: card.currency,
                        merchant_name: 'DigiStreets Monthly Fee',
                        merchant_category: 'FEES',
                        status: 'completed',
                        description: 'Monthly card maintenance fee',
                        metadata: {
                            fee_type: 'monthly_maintenance',
                            billing_month: new Date().toISOString().slice(0, 7)
                        }
                    });
                    feesCharged += deductAmount;
                    remainingFees -= deductAmount;
                    cardsAffected++;
                }
            }
        }
        // Store cards that will be deactivated for later reference
        let cardsToDeactivate = [];
        // Step 3: If still have remaining fees, deactivate cards
        if (remainingFees > 0) {
            // Deactivate cards starting with those that have the least balance
            cardsToDeactivate = [...cardsWithFees].sort((a, b) => (a.remaining_balance || 0) - (b.remaining_balance || 0));
            for (const card of cardsToDeactivate) {
                if (remainingFees <= 0)
                    break;
                const cardFee = card.monthly_fee_amount || 0;
                // Deactivate the card
                await cardRepository_1.CardRepository.update(card.id, {
                    status: 'deleted', // Using 'deleted' as deactivated
                    metadata: {
                        ...card.metadata,
                        deactivation_reason: 'insufficient_balance_for_monthly_fee',
                        deactivation_date: new Date().toISOString(),
                        unpaid_fee: cardFee
                    }
                });
                // Create notification record
                await database_1.default
                    .from('notifications')
                    .insert({
                    user_id: userId,
                    type: 'card_deactivated',
                    title: 'Card Deactivated Due to Unpaid Fees',
                    message: `Your card ending in ${card.masked_pan.slice(-4)} has been deactivated due to insufficient balance for monthly fees.`,
                    metadata: {
                        card_id: card.id,
                        card_last_four: card.masked_pan.slice(-4),
                        unpaid_amount: cardFee
                    }
                });
                cardsDeactivated++;
                remainingFees -= cardFee;
            }
        }
        // Update monthly fee records
        const billingMonth = new Date();
        billingMonth.setDate(1);
        for (const card of cardsWithFees) {
            const feeStatus = cardsDeactivated > 0 &&
                cardsToDeactivate.find(c => c.id === card.id)?.status === 'deleted'
                ? 'failed'
                : 'charged';
            await database_1.default
                .from('card_monthly_fees')
                .update({
                fee_status: feeStatus,
                charged_at: feeStatus === 'charged' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            })
                .eq('card_id', card.id)
                .eq('billing_month', billingMonth.toISOString().split('T')[0]);
        }
        return {
            userId,
            processed: true,
            feesCharged,
            cardsAffected,
            cardsDeactivated
        };
    }
    catch (error) {
        logger_1.default.error(`Error processing monthly fees for user ${userId}:`, error);
        throw error;
    }
}
/**
 * Create the monthly fee processor worker
 */
function createMonthlyFeeWorker() {
    const redisUrl = env_1.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new ioredis_1.default(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });
    const worker = new bullmq_1.Worker('monthly-fee-processing', async (job) => {
        const { type, userId } = job.data;
        logger_1.default.info(`Processing monthly fee job: ${type}`, { userId });
        try {
            if (type === 'process_all_users') {
                return await processAllUsersMonthlyFees();
            }
            else if (type === 'process_user' && userId) {
                return await processUserMonthlyFees(userId);
            }
            else {
                throw new Error('Invalid job type or missing userId');
            }
        }
        catch (error) {
            logger_1.default.error('Monthly fee processing failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }, {
        connection,
        concurrency: 1, // Process one at a time to avoid race conditions
        limiter: {
            max: 10,
            duration: 60000 // Max 10 jobs per minute
        }
    });
    worker.on('completed', (job) => {
        logger_1.default.info(`Monthly fee job ${job.id} completed`, job.returnvalue);
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Monthly fee job ${job?.id} failed:`, err);
    });
    return worker;
}
//# sourceMappingURL=monthlyFeeProcessor.js.map