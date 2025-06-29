"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBalanceReconciliationWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const admediacards_1 = require("../../integrations/admediacards");
const database_1 = require("../../config/database");
const logger_1 = __importDefault(require("../../utils/logger"));
const redis_1 = require("../../config/redis");
/**
 * Process balance reconciliation jobs
 * Ensures our balance records match actual balances
 */
const createBalanceReconciliationWorker = () => {
    const connection = (0, redis_1.createRedisConnection)();
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.BALANCE_RECONCILIATION, async (job) => {
        const { type } = job.data;
        logger_1.default.info('Starting balance reconciliation job', {
            jobId: job.id,
            type
        });
        try {
            await job.updateProgress(10);
            const results = {
                type,
                startedAt: new Date().toISOString(),
                discrepancies: []
            };
            if (type === 'master_account' || type === 'full') {
                // Reconcile master account balance
                await job.updateProgress(20);
                results.masterAccount = await reconcileMasterAccount();
            }
            if (type === 'user_balances' || type === 'full') {
                // Reconcile user balances
                await job.updateProgress(50);
                results.userBalances = await reconcileUserBalances(job);
            }
            await job.updateProgress(100);
            results.completedAt = new Date().toISOString();
            logger_1.default.info('Balance reconciliation job completed', {
                jobId: job.id,
                ...results
            });
            return results;
        }
        catch (error) {
            logger_1.default.error('Balance reconciliation job failed', {
                jobId: job.id,
                error
            });
            throw error;
        }
    }, {
        connection,
        concurrency: 1 // Only one reconciliation at a time
    });
    worker.on('completed', (job) => {
        logger_1.default.info(`Balance reconciliation job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Balance reconciliation job ${job?.id} failed:`, err);
    });
    return worker;
};
exports.createBalanceReconciliationWorker = createBalanceReconciliationWorker;
/**
 * Reconcile master account balance with Admediacards
 */
async function reconcileMasterAccount() {
    const admediacardsClient = (0, admediacards_1.getAdmediacardsClient)();
    try {
        // Get master account balance from Admediacards
        const accountBalance = await admediacardsClient.getMasterAccountBalance();
        // Calculate expected balance from our active cards
        const { data: activeCards, error } = await database_1.supabase
            .from('virtual_cards')
            .select('remaining_balance')
            .eq('status', 'active');
        if (error)
            throw error;
        const ourTotalBalance = activeCards?.reduce((sum, card) => sum + (card.remaining_balance || 0), 0) || 0;
        // Check for discrepancy
        const difference = Math.abs(accountBalance - ourTotalBalance);
        const hasDiscrepancy = difference > 0.01; // Allow 1 cent tolerance
        // Update master account config
        const { error: updateError } = await database_1.supabase
            .from('master_account_config')
            .update({
            admediacards_balance: accountBalance,
            last_sync_at: new Date()
        })
            .eq('id', 1); // Assuming single master account
        if (updateError)
            throw updateError;
        if (hasDiscrepancy) {
            logger_1.default.warn('Master account balance discrepancy detected', {
                ourBalance: ourTotalBalance,
                providerBalance: accountBalance,
                difference
            });
        }
        return {
            providerBalance: accountBalance,
            calculatedBalance: ourTotalBalance,
            difference,
            hasDiscrepancy
        };
    }
    catch (error) {
        logger_1.default.error('Failed to reconcile master account', error);
        throw error;
    }
}
/**
 * Reconcile user balances with card totals
 */
async function reconcileUserBalances(job) {
    const results = {
        totalUsers: 0,
        discrepancies: 0,
        corrections: 0
    };
    try {
        // Get all users with their virtual balance
        const { data: users, error } = await database_1.supabase
            .from('user_profiles')
            .select('id, virtual_balance')
            .gt('virtual_balance', 0);
        if (error)
            throw error;
        results.totalUsers = users?.length || 0;
        // Process each user
        for (let i = 0; i < (users?.length || 0); i++) {
            const user = users?.[i];
            if (!user)
                continue;
            const progress = 50 + (i / (users?.length || 1)) * 40;
            await job.updateProgress(progress);
            // Calculate user's actual balance from cards
            const { data: userCards, error: cardsError } = await database_1.supabase
                .from('virtual_cards')
                .select('remaining_balance')
                .eq('user_id', user.id)
                .eq('status', 'active');
            if (cardsError) {
                logger_1.default.error('Failed to get user cards', { userId: user.id, error: cardsError });
                continue;
            }
            const cardsTotalBalance = userCards?.reduce((sum, card) => sum + (card.remaining_balance || 0), 0) || 0;
            // Check for discrepancy
            const difference = Math.abs(user.virtual_balance - cardsTotalBalance);
            if (difference > 0.01) {
                results.discrepancies++;
                logger_1.default.warn('User balance discrepancy detected', {
                    userId: user.id,
                    virtualBalance: user.virtual_balance,
                    cardsTotal: cardsTotalBalance,
                    difference
                });
                // Create audit log entry
                await database_1.supabase
                    .from('audit_logs')
                    .insert({
                    user_id: user.id,
                    action: 'balance_discrepancy_detected',
                    resource_type: 'user_balance',
                    metadata: {
                        virtual_balance: user.virtual_balance,
                        cards_total: cardsTotalBalance,
                        difference,
                        job_id: job.id
                    }
                });
            }
        }
        return results;
    }
    catch (error) {
        logger_1.default.error('Failed to reconcile user balances', error);
        throw error;
    }
}
//# sourceMappingURL=balanceReconciliationProcessor.js.map