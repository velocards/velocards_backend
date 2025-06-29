import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';
import logger from '../utils/logger';

// Create a dedicated Redis connection for BullMQ
// Using different connection than our session Redis to avoid conflicts
const createRedisConnection = () => {
  const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
  
  try {
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy: (times: number) => {
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
      logger.error('Queue Redis connection error:', error);
    });

    redis.on('connect', () => {
      logger.info('Queue Redis connected successfully');
    });

    return redis;
  } catch (error) {
    logger.error('Failed to create Redis connection for queues:', error);
    throw error;
  }
};

// Queue names
export const QUEUE_NAMES = {
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
} as const;

// Default job options
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
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

export const queues = {
  transactionSync: new Queue(QUEUE_NAMES.TRANSACTION_SYNC, { connection }),
  cardSync: new Queue(QUEUE_NAMES.CARD_SYNC, { connection }),
  balanceReconciliation: new Queue(QUEUE_NAMES.BALANCE_RECONCILIATION, { connection }),
  webhookProcessing: new Queue(QUEUE_NAMES.WEBHOOK_PROCESSING, { connection }),
  cryptoOrderSync: new Queue(QUEUE_NAMES.CRYPTO_ORDER_SYNC, { connection }),
  cryptoOrderCheck: new Queue(QUEUE_NAMES.CRYPTO_ORDER_CHECK, { connection }),
  userBalanceUpdate: new Queue(QUEUE_NAMES.USER_BALANCE_UPDATE, { connection }),
  sessionCleanup: new Queue(QUEUE_NAMES.SESSION_CLEANUP, { connection }),
  sessionMonitoring: new Queue(QUEUE_NAMES.SESSION_MONITORING, { connection }),
  emailNotifications: new Queue(QUEUE_NAMES.EMAIL_NOTIFICATIONS, { connection }),
  dailyReports: new Queue(QUEUE_NAMES.DAILY_REPORTS, { connection }),
  tierUpgrade: new Queue(QUEUE_NAMES.TIER_UPGRADE, { connection }),
  monthlyFeeProcessing: new Queue(QUEUE_NAMES.MONTHLY_FEE_PROCESSING, { connection }),
  invoiceProcessing: new Queue(QUEUE_NAMES.INVOICE_PROCESSING, { connection })
};

// Queue event monitoring
export const createQueueEvents = (queueName: string) => {
  const queueEvents = new QueueEvents(queueName, { connection });
  
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    logger.info(`Job ${jobId} in queue ${queueName} completed`, { returnvalue });
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error(`Job ${jobId} in queue ${queueName} failed`, { failedReason });
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    logger.debug(`Job ${jobId} in queue ${queueName} progress`, { data });
  });

  return queueEvents;
};

// Helper to add recurring jobs
export const addRecurringJob = async (
  queue: Queue,
  jobName: string,
  data: any,
  cronPattern: string
) => {
  try {
    await queue.add(
      jobName,
      data,
      {
        repeat: {
          pattern: cronPattern
        },
        ...DEFAULT_JOB_OPTIONS
      }
    );
    logger.info(`Added recurring job ${jobName} with pattern ${cronPattern}`);
  } catch (error) {
    logger.error(`Failed to add recurring job ${jobName}:`, error);
    throw error;
  }
};

// Graceful shutdown
export const shutdownQueues = async () => {
  logger.info('Shutting down job queues...');
  
  const allQueues = Object.values(queues);
  
  // Close all queues
  await Promise.all(allQueues.map(queue => queue.close()));
  
  // Close Redis connection
  connection.disconnect();
  
  logger.info('Job queues shut down successfully');
};