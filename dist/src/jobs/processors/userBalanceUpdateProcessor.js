"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserBalanceUpdateWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const redis_1 = require("../../config/redis");
const userRepository_1 = require("../../repositories/userRepository");
const userBalanceLedgerRepository_1 = require("../../repositories/userBalanceLedgerRepository");
const cryptoTransactionRepository_1 = require("../../repositories/cryptoTransactionRepository");
const logger_1 = __importDefault(require("../../utils/logger"));
const createUserBalanceUpdateWorker = () => {
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.USER_BALANCE_UPDATE, async (job) => {
        const { userId, amount, type, reason, referenceType, referenceId, description, cryptoTransactionId } = job.data;
        logger_1.default.info('Processing user balance update', {
            jobId: job.id,
            userId,
            amount,
            type,
            reason
        });
        try {
            // Validate user exists
            const user = await userRepository_1.UserRepository.findById(userId);
            if (!user) {
                throw new Error(`User not found: ${userId}`);
            }
            // Get current balance
            const currentBalance = user.virtual_balance || 0;
            // Calculate new balance
            let newBalance;
            if (type === 'credit') {
                newBalance = currentBalance + amount;
            }
            else {
                newBalance = currentBalance - amount;
                // Prevent negative balance for certain operations
                if (newBalance < 0 && (reason === 'card_funding' || reason === 'withdrawal')) {
                    throw new Error(`Insufficient balance: ${currentBalance} < ${amount}`);
                }
            }
            await job.updateProgress(30);
            // Map reason to transaction type
            const transactionTypeMap = {
                'crypto_deposit_completed': 'deposit',
                'card_funding': 'card_funding',
                'refund': 'refund',
                'fee': 'fee',
                'adjustment': 'adjustment',
                'withdrawal': 'withdrawal'
            };
            const transactionType = transactionTypeMap[reason] || 'deposit';
            try {
                // Update user balance
                await userRepository_1.UserRepository.updateBalance(userId, newBalance);
                await job.updateProgress(60);
                // Create ledger entry
                await userBalanceLedgerRepository_1.UserBalanceLedgerRepository.create({
                    user_id: userId,
                    transaction_type: transactionType,
                    amount: type === 'credit' ? amount : -amount,
                    balance_before: currentBalance,
                    balance_after: newBalance,
                    reference_type: referenceType || reason,
                    reference_id: referenceId || cryptoTransactionId || `job_${job.id}`,
                    description: description || `${type === 'credit' ? 'Credit' : 'Debit'} - ${reason}`
                });
                await job.updateProgress(80);
                // Update related records
                if (cryptoTransactionId) {
                    await cryptoTransactionRepository_1.CryptoTransactionRepository.markAsProcessed(cryptoTransactionId);
                }
                // All operations completed successfully
                await job.updateProgress(100);
                const result = {
                    userId,
                    previousBalance: currentBalance,
                    newBalance,
                    amountChanged: type === 'credit' ? amount : -amount,
                    reason,
                    timestamp: new Date().toISOString()
                };
                logger_1.default.info('User balance updated successfully', result);
                // Trigger notifications for significant changes
                if (amount >= 100) { // $100 or more
                    const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
                    await queues.emailNotifications.add('balance-update-notification', {
                        userId,
                        amount,
                        type,
                        reason,
                        newBalance
                    });
                }
                return result;
            }
            catch (error) {
                throw error;
            }
        }
        catch (error) {
            logger_1.default.error('User balance update failed', {
                error: error.message,
                jobId: job.id,
                userId,
                amount,
                type,
                reason
            });
            throw error;
        }
    }, {
        connection: (0, redis_1.createRedisConnection)(),
        concurrency: 5, // Process multiple balance updates simultaneously
        limiter: {
            max: 100, // Maximum 100 balance updates
            duration: 60000 // per minute
        }
    });
    worker.on('completed', (job, result) => {
        logger_1.default.info('User balance update job completed', {
            jobId: job.id,
            userId: job.data.userId,
            result
        });
    });
    worker.on('failed', (job, error) => {
        logger_1.default.error('User balance update job failed', {
            jobId: job?.id,
            userId: job?.data?.userId,
            error: error.message,
            jobData: job?.data
        });
    });
    return worker;
};
exports.createUserBalanceUpdateWorker = createUserBalanceUpdateWorker;
//# sourceMappingURL=userBalanceUpdateProcessor.js.map