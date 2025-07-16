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
exports.createCryptoOrderCheckWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const redis_1 = require("../../config/redis");
const cryptoTransactionRepository_1 = require("../../repositories/cryptoTransactionRepository");
const cryptoRepository_1 = require("../../repositories/cryptoRepository");
const logger_1 = __importDefault(require("../../utils/logger"));
const createCryptoOrderCheckWorker = () => {
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.CRYPTO_ORDER_CHECK, async (job) => {
        const { checkStuckOrders = true, cleanupExpiredOrders = true, maxPendingHours = 2, maxOrderAgeDays = 7 } = job.data;
        logger_1.default.info('Starting crypto order check', {
            jobId: job.id,
            checkStuckOrders,
            cleanupExpiredOrders,
            maxPendingHours,
            maxOrderAgeDays
        });
        try {
            const results = {
                stuckOrders: 0,
                expiredOrders: 0,
                expiredXMoneyOrders: 0,
                retriedOrders: 0,
                notifiedUsers: 0,
                errors: 0
            };
            // Check for stuck orders (pending too long)
            if (checkStuckOrders) {
                const stuckCutoff = new Date();
                stuckCutoff.setHours(stuckCutoff.getHours() - maxPendingHours);
                const stuckOrders = await cryptoTransactionRepository_1.CryptoTransactionRepository.findStuckOrders(stuckCutoff);
                results.stuckOrders = stuckOrders.length;
                logger_1.default.info(`Found ${stuckOrders.length} stuck orders`);
                for (const order of stuckOrders) {
                    try {
                        // Trigger immediate sync for stuck orders
                        const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
                        await queues.cryptoOrderSync.add('sync-stuck-order', {
                            orderId: order.xmoney_payment_id
                        }, {
                            priority: 10, // High priority
                            delay: 0 // Immediate
                        });
                        results.retriedOrders++;
                    }
                    catch (error) {
                        logger_1.default.error('Failed to retry stuck order', {
                            orderId: order.xmoney_payment_id,
                            error: error.message
                        });
                        results.errors++;
                    }
                }
            }
            // Clean up expired orders
            if (cleanupExpiredOrders) {
                const expiredCutoff = new Date();
                expiredCutoff.setDate(expiredCutoff.getDate() - maxOrderAgeDays);
                const expiredOrders = await cryptoTransactionRepository_1.CryptoTransactionRepository.findExpiredOrders(expiredCutoff);
                results.expiredOrders = expiredOrders.length;
                logger_1.default.info(`Found ${expiredOrders.length} expired orders`);
                for (const order of expiredOrders) {
                    try {
                        // Mark as expired if still pending
                        if (order.status === 'pending' || order.status === 'confirming') {
                            await cryptoTransactionRepository_1.CryptoTransactionRepository.markAsExpired(order.id);
                            // Notify user about expired order
                            const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
                            await queues.emailNotifications.add('crypto-order-expired', {
                                userId: order.user_id,
                                orderId: order.xmoney_payment_id,
                                amount: order.fiat_amount,
                                currency: order.crypto_currency,
                                createdAt: order.created_at
                            });
                            results.notifiedUsers++;
                        }
                    }
                    catch (error) {
                        logger_1.default.error('Failed to process expired order', {
                            orderId: order.xmoney_payment_id,
                            error: error.message
                        });
                        results.errors++;
                    }
                }
            }
            // Also check for expired orders in xmoney_orders table
            if (cleanupExpiredOrders) {
                const expiredCutoff = new Date();
                expiredCutoff.setDate(expiredCutoff.getDate() - maxOrderAgeDays);
                const expiredXMoneyOrders = await cryptoRepository_1.CryptoRepository.findExpiredXMoneyOrders(expiredCutoff);
                results.expiredXMoneyOrders = expiredXMoneyOrders.length;
                logger_1.default.info(`Found ${expiredXMoneyOrders.length} expired xmoney orders`);
                for (const order of expiredXMoneyOrders) {
                    try {
                        // Mark as expired
                        await cryptoRepository_1.CryptoRepository.markOrderAsExpired(order.id);
                        // Log the expiration
                        logger_1.default.info('Marked xmoney order as expired', {
                            orderId: order.id,
                            orderReference: order.order_reference,
                            userId: order.user_id,
                            amount: order.amount,
                            createdAt: order.created_at,
                            daysOld: Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24))
                        });
                        // Notify user about expired order (optional)
                        const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
                        await queues.emailNotifications.add('deposit-order-expired', {
                            userId: order.user_id,
                            orderReference: order.order_reference,
                            amount: order.amount,
                            currency: order.currency,
                            createdAt: order.created_at
                        });
                        results.notifiedUsers++;
                    }
                    catch (error) {
                        logger_1.default.error('Failed to process expired xmoney order', {
                            orderId: order.id,
                            orderReference: order.order_reference,
                            error: error.message
                        });
                        results.errors++;
                    }
                }
            }
            // Additional health checks
            await job.updateProgress(50);
            // Check for orders with inconsistent states
            const inconsistentOrders = await cryptoTransactionRepository_1.CryptoTransactionRepository.findInconsistentStates();
            if (inconsistentOrders.length > 0) {
                logger_1.default.warn(`Found ${inconsistentOrders.length} orders with inconsistent states`);
                // Trigger sync for inconsistent orders
                for (const order of inconsistentOrders) {
                    const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
                    await queues.cryptoOrderSync.add('sync-inconsistent-order', {
                        orderId: order.xmoney_payment_id
                    });
                }
            }
            await job.updateProgress(100);
            logger_1.default.info('Crypto order check completed', results);
            return results;
        }
        catch (error) {
            logger_1.default.error('Crypto order check failed', {
                error: error.message,
                jobId: job.id
            });
            throw error;
        }
    }, {
        connection: (0, redis_1.createRedisConnection)(),
        concurrency: 1, // Only one check job at a time
        limiter: {
            max: 5, // Maximum 5 check jobs
            duration: 300000 // per 5 minutes
        }
    });
    worker.on('completed', (job, result) => {
        logger_1.default.info('Crypto order check job completed', {
            jobId: job.id,
            result
        });
    });
    worker.on('failed', (job, error) => {
        logger_1.default.error('Crypto order check job failed', {
            jobId: job?.id,
            error: error.message
        });
    });
    return worker;
};
exports.createCryptoOrderCheckWorker = createCryptoOrderCheckWorker;
//# sourceMappingURL=cryptoOrderCheckProcessor.js.map