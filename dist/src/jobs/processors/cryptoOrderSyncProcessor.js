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
exports.createCryptoOrderSyncWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const redis_1 = require("../../config/redis");
const cryptoTransactionRepository_1 = require("../../repositories/cryptoTransactionRepository");
const client_1 = require("../../integrations/xmoney/client");
const logger_1 = __importDefault(require("../../utils/logger"));
const createCryptoOrderSyncWorker = () => {
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.CRYPTO_ORDER_SYNC, async (job) => {
        const { orderId, userId, fullSync, maxAge = 24 } = job.data;
        logger_1.default.info('Starting crypto order sync', {
            jobId: job.id,
            orderId,
            userId,
            fullSync
        });
        try {
            const xmoneyClient = (0, client_1.getXMoneyClient)();
            let ordersToSync = [];
            let syncedCount = 0;
            let updatedCount = 0;
            if (orderId) {
                // Sync specific order
                const order = await cryptoTransactionRepository_1.CryptoTransactionRepository.findByXMoneyId(orderId);
                if (order) {
                    ordersToSync = [order];
                }
                else {
                    logger_1.default.warn('Order not found in database', { orderId });
                    return { error: 'Order not found', orderId };
                }
            }
            else if (userId) {
                // Sync all pending orders for a user
                const orders = await cryptoTransactionRepository_1.CryptoTransactionRepository.findPendingByUser(userId);
                ordersToSync = orders;
            }
            else if (fullSync) {
                // Sync all pending orders (limited by age)
                const cutoffTime = new Date();
                cutoffTime.setHours(cutoffTime.getHours() - maxAge);
                const orders = await cryptoTransactionRepository_1.CryptoTransactionRepository.findPendingAfter(cutoffTime);
                ordersToSync = orders;
            }
            logger_1.default.info(`Found ${ordersToSync.length} orders to sync`);
            // Process each order
            for (const localOrder of ordersToSync) {
                try {
                    await job.updateProgress((syncedCount / ordersToSync.length) * 100);
                    // Get latest status from xMoney
                    const xmoneyOrder = await xmoneyClient.getOrder(localOrder.xmoney_payment_id);
                    // Check if status changed
                    const orderStatus = xmoneyOrder.data.attributes.status === 'paid' ? 'completed' : 'pending';
                    const orderAmount = parseFloat(xmoneyOrder.data.attributes.total_amount.value);
                    const needsUpdate = localOrder.status !== orderStatus ||
                        localOrder.fiat_amount !== orderAmount;
                    if (needsUpdate) {
                        // Update crypto transaction
                        await cryptoTransactionRepository_1.CryptoTransactionRepository.updateFromXMoney(localOrder.id, {
                            status: orderStatus,
                            fiat_amount: orderAmount,
                            synced_at: new Date()
                        });
                        // If order is now completed, trigger balance update
                        if (orderStatus === 'completed' && localOrder.status !== 'completed') {
                            // Add job to update user balance
                            const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
                            await queues.userBalanceUpdate.add('crypto-deposit-completed', {
                                userId: localOrder.user_id,
                                cryptoTransactionId: localOrder.id,
                                amount: orderAmount,
                                reason: 'crypto_deposit_completed'
                            });
                            logger_1.default.info('Triggered balance update for completed order', {
                                orderId: localOrder.xmoney_payment_id,
                                userId: localOrder.user_id,
                                amount: orderAmount
                            });
                        }
                        // Log status change for debugging
                        logger_1.default.info('Order status synchronized', {
                            orderId: localOrder.xmoney_payment_id,
                            userId: localOrder.user_id,
                            oldStatus: localOrder.status,
                            newStatus: orderStatus,
                            amount: orderAmount
                        });
                        updatedCount++;
                    }
                    syncedCount++;
                }
                catch (orderError) {
                    logger_1.default.error('Failed to sync individual order', {
                        orderId: localOrder.xmoney_payment_id,
                        error: orderError.message
                    });
                    // Continue with other orders
                }
            }
            const result = {
                totalOrders: ordersToSync.length,
                syncedOrders: syncedCount,
                updatedOrders: updatedCount,
                timestamp: new Date().toISOString()
            };
            logger_1.default.info('Crypto order sync completed', result);
            return result;
        }
        catch (error) {
            logger_1.default.error('Crypto order sync failed', {
                error: error.message,
                jobId: job.id,
                jobData: job.data
            });
            throw error;
        }
    }, {
        connection: (0, redis_1.createRedisConnection)(),
        concurrency: 2, // Process 2 sync jobs simultaneously
        limiter: {
            max: 10, // Maximum 10 jobs
            duration: 60000 // per minute
        }
    });
    worker.on('completed', (job, result) => {
        logger_1.default.info('Crypto order sync job completed', {
            jobId: job.id,
            result
        });
    });
    worker.on('failed', (job, error) => {
        logger_1.default.error('Crypto order sync job failed', {
            jobId: job?.id,
            error: error.message,
            jobData: job?.data
        });
    });
    return worker;
};
exports.createCryptoOrderSyncWorker = createCryptoOrderSyncWorker;
//# sourceMappingURL=cryptoOrderSyncProcessor.js.map