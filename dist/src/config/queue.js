"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shutdownQueues = exports.addRecurringJob = exports.createQueueEvents = exports.queues = exports.DEFAULT_JOB_OPTIONS = exports.QUEUE_NAMES = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const logger_1 = __importDefault(require("../utils/logger"));
// Create a dedicated Redis connection for BullMQ
// Using different connection than our session Redis to avoid conflicts
const createRedisConnection = () => {
    const redisUrl = env_1.env.REDIS_URL || 'redis://localhost:6379';
    try {
        const redis = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: null, // Required by BullMQ
            enableReadyCheck: false,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            reconnectOnError: (err) => {
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    // Only reconnect when the error contains "READONLY"
                    return true;
                }
                return false;
            }
        });
        redis.on('error', (error) => {
            logger_1.default.error('Queue Redis connection error:', error);
        });
        redis.on('connect', () => {
            logger_1.default.info('Queue Redis connected successfully');
        });
        return redis;
    }
    catch (error) {
        logger_1.default.error('Failed to create Redis connection for queues:', error);
        throw error;
    }
};
// Queue names
exports.QUEUE_NAMES = {
    TRANSACTION_SYNC: 'transaction-sync',
    CARD_SYNC: 'card-sync',
    BALANCE_RECONCILIATION: 'balance-reconciliation',
    WEBHOOK_PROCESSING: 'webhook-processing',
    CRYPTO_ORDER_SYNC: 'crypto-order-sync',
    CRYPTO_ORDER_CHECK: 'crypto-order-check',
    USER_BALANCE_UPDATE: 'user-balance-update',
    SESSION_CLEANUP: 'session-cleanup',
    SESSION_MONITORING: 'session-monitoring',
    EMAIL_NOTIFICATIONS: 'email-notifications',
    DAILY_REPORTS: 'daily-reports',
    TIER_UPGRADE: 'tier-upgrade',
    MONTHLY_FEE_PROCESSING: 'monthly-fee-processing',
    INVOICE_PROCESSING: 'invoice-processing'
};
// Default job options
exports.DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 2000
    },
    removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100 // Keep max 100 completed jobs
    },
    removeOnFail: {
        age: 24 * 3600 // Keep failed jobs for 24 hours
    }
};
// Create queue instances
const connection = createRedisConnection();
exports.queues = {
    transactionSync: new bullmq_1.Queue(exports.QUEUE_NAMES.TRANSACTION_SYNC, { connection }),
    cardSync: new bullmq_1.Queue(exports.QUEUE_NAMES.CARD_SYNC, { connection }),
    balanceReconciliation: new bullmq_1.Queue(exports.QUEUE_NAMES.BALANCE_RECONCILIATION, { connection }),
    webhookProcessing: new bullmq_1.Queue(exports.QUEUE_NAMES.WEBHOOK_PROCESSING, { connection }),
    cryptoOrderSync: new bullmq_1.Queue(exports.QUEUE_NAMES.CRYPTO_ORDER_SYNC, { connection }),
    cryptoOrderCheck: new bullmq_1.Queue(exports.QUEUE_NAMES.CRYPTO_ORDER_CHECK, { connection }),
    userBalanceUpdate: new bullmq_1.Queue(exports.QUEUE_NAMES.USER_BALANCE_UPDATE, { connection }),
    sessionCleanup: new bullmq_1.Queue(exports.QUEUE_NAMES.SESSION_CLEANUP, { connection }),
    sessionMonitoring: new bullmq_1.Queue(exports.QUEUE_NAMES.SESSION_MONITORING, { connection }),
    emailNotifications: new bullmq_1.Queue(exports.QUEUE_NAMES.EMAIL_NOTIFICATIONS, { connection }),
    dailyReports: new bullmq_1.Queue(exports.QUEUE_NAMES.DAILY_REPORTS, { connection }),
    tierUpgrade: new bullmq_1.Queue(exports.QUEUE_NAMES.TIER_UPGRADE, { connection }),
    monthlyFeeProcessing: new bullmq_1.Queue(exports.QUEUE_NAMES.MONTHLY_FEE_PROCESSING, { connection }),
    invoiceProcessing: new bullmq_1.Queue(exports.QUEUE_NAMES.INVOICE_PROCESSING, { connection })
};
// Queue event monitoring
const createQueueEvents = (queueName) => {
    const queueEvents = new bullmq_1.QueueEvents(queueName, { connection });
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
        logger_1.default.info(`Job ${jobId} in queue ${queueName} completed`, { returnvalue });
    });
    queueEvents.on('failed', ({ jobId, failedReason }) => {
        logger_1.default.error(`Job ${jobId} in queue ${queueName} failed`, { failedReason });
    });
    queueEvents.on('progress', ({ jobId, data }) => {
        logger_1.default.debug(`Job ${jobId} in queue ${queueName} progress`, { data });
    });
    return queueEvents;
};
exports.createQueueEvents = createQueueEvents;
// Helper to add recurring jobs
const addRecurringJob = async (queue, jobName, data, cronPattern) => {
    try {
        await queue.add(jobName, data, {
            repeat: {
                pattern: cronPattern
            },
            ...exports.DEFAULT_JOB_OPTIONS
        });
        logger_1.default.info(`Added recurring job ${jobName} with pattern ${cronPattern}`);
    }
    catch (error) {
        logger_1.default.error(`Failed to add recurring job ${jobName}:`, error);
        throw error;
    }
};
exports.addRecurringJob = addRecurringJob;
// Graceful shutdown
const shutdownQueues = async () => {
    logger_1.default.info('Shutting down job queues...');
    const allQueues = Object.values(exports.queues);
    // Close all queues
    await Promise.all(allQueues.map(queue => queue.close()));
    // Close Redis connection
    connection.disconnect();
    logger_1.default.info('Job queues shut down successfully');
};
exports.shutdownQueues = shutdownQueues;
//# sourceMappingURL=queue.js.map