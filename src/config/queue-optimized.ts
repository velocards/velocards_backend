import { Queue, QueueEvents, QueueOptions, WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';
import logger from '../utils/logger';

// ===== SHARED CONNECTION POOL =====
// This reduces connections from 32 to 3
class RedisConnectionPool {
  private static instance: RedisConnectionPool;
  private sharedConnection: IORedis | null = null;
  private subscriberConnection: IORedis | null = null;
  private connections = 0;

  private constructor() {}

  static getInstance(): RedisConnectionPool {
    if (!RedisConnectionPool.instance) {
      RedisConnectionPool.instance = new RedisConnectionPool();
    }
    return RedisConnectionPool.instance;
  }

  private createConnection(name: string): IORedis {
    const redisUrl = (env.USE_UPSTASH_REDIS && env.REDIS_UPSTASH_URL) 
      ? env.REDIS_UPSTASH_URL 
      : env.REDIS_URL;
    
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      connectTimeout: 30000,
      disconnectTimeout: 5000,
      commandTimeout: 30000,
      keepAlive: 30000,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      }
    });

    connection.on('error', (error) => {
      logger.error(`Redis ${name} connection error:`, error);
    });

    connection.on('connect', () => {
      this.connections++;
      logger.info(`Redis ${name} connection established. Total connections: ${this.connections}`);
    });

    connection.on('close', () => {
      this.connections--;
      logger.info(`Redis ${name} connection closed. Total connections: ${this.connections}`);
    });

    return connection;
  }

  getSharedConnection(): IORedis {
    if (!this.sharedConnection) {
      this.sharedConnection = this.createConnection('shared');
    }
    return this.sharedConnection;
  }

  getSubscriberConnection(): IORedis {
    if (!this.subscriberConnection) {
      this.subscriberConnection = this.createConnection('subscriber');
    }
    return this.subscriberConnection;
  }

  async closeAll(): Promise<void> {
    const promises: Promise<any>[] = [];
    
    if (this.sharedConnection) {
      promises.push(this.sharedConnection.quit());
    }
    
    if (this.subscriberConnection) {
      promises.push(this.subscriberConnection.quit());
    }
    
    await Promise.all(promises);
    this.sharedConnection = null;
    this.subscriberConnection = null;
    logger.info('All Redis connections closed');
  }

  getConnectionCount(): number {
    return this.connections;
  }
}

// ===== QUEUE CONFIGURATION =====
// Get the connection pool instance
const connectionPool = RedisConnectionPool.getInstance();

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
  INVOICE_PROCESSING: 'invoice-processing',
  PASSWORD_RESET_CLEANUP: 'password-reset-cleanup',
  EMAIL_VERIFICATION_CLEANUP: 'email-verification-cleanup'
} as const;

// ===== OPTIMIZED SETTINGS =====
// Default job options with reduced retention
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000
  },
  removeOnComplete: {
    age: 300, // 5 minutes (was 3600)
    count: 10 // 10 jobs (was 100)
  },
  removeOnFail: {
    age: 3600 // 1 hour (was 24 hours)
  }
};

// Optimized queue options with reduced polling
const OPTIMIZED_QUEUE_OPTIONS: QueueOptions = {
  connection: connectionPool.getSharedConnection(),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
};

// Optimized worker options with reduced polling frequency
export const OPTIMIZED_WORKER_OPTIONS: WorkerOptions = {
  connection: connectionPool.getSharedConnection(),
  concurrency: 5,
  stalledInterval: 30000, // Check for stalled jobs every 30s
  drainDelay: 200, // Wait 200ms between polling when queue is empty (was ~5-10ms)
};

// ===== CREATE QUEUES WITH SHARED CONNECTION =====
// All queues now share the same connection
export const queues = {
  transactionSync: new Queue(QUEUE_NAMES.TRANSACTION_SYNC, OPTIMIZED_QUEUE_OPTIONS),
  cardSync: new Queue(QUEUE_NAMES.CARD_SYNC, OPTIMIZED_QUEUE_OPTIONS),
  balanceReconciliation: new Queue(QUEUE_NAMES.BALANCE_RECONCILIATION, OPTIMIZED_QUEUE_OPTIONS),
  webhookProcessing: new Queue(QUEUE_NAMES.WEBHOOK_PROCESSING, OPTIMIZED_QUEUE_OPTIONS),
  cryptoOrderSync: new Queue(QUEUE_NAMES.CRYPTO_ORDER_SYNC, OPTIMIZED_QUEUE_OPTIONS),
  cryptoOrderCheck: new Queue(QUEUE_NAMES.CRYPTO_ORDER_CHECK, OPTIMIZED_QUEUE_OPTIONS),
  userBalanceUpdate: new Queue(QUEUE_NAMES.USER_BALANCE_UPDATE, OPTIMIZED_QUEUE_OPTIONS),
  sessionCleanup: new Queue(QUEUE_NAMES.SESSION_CLEANUP, OPTIMIZED_QUEUE_OPTIONS),
  sessionMonitoring: new Queue(QUEUE_NAMES.SESSION_MONITORING, OPTIMIZED_QUEUE_OPTIONS),
  emailNotifications: new Queue(QUEUE_NAMES.EMAIL_NOTIFICATIONS, OPTIMIZED_QUEUE_OPTIONS),
  dailyReports: new Queue(QUEUE_NAMES.DAILY_REPORTS, OPTIMIZED_QUEUE_OPTIONS),
  tierUpgrade: new Queue(QUEUE_NAMES.TIER_UPGRADE, OPTIMIZED_QUEUE_OPTIONS),
  monthlyFeeProcessing: new Queue(QUEUE_NAMES.MONTHLY_FEE_PROCESSING, OPTIMIZED_QUEUE_OPTIONS),
  invoiceProcessing: new Queue(QUEUE_NAMES.INVOICE_PROCESSING, OPTIMIZED_QUEUE_OPTIONS),
  passwordResetCleanup: new Queue(QUEUE_NAMES.PASSWORD_RESET_CLEANUP, OPTIMIZED_QUEUE_OPTIONS),
  emailVerificationCleanup: new Queue(QUEUE_NAMES.EMAIL_VERIFICATION_CLEANUP, OPTIMIZED_QUEUE_OPTIONS)
};

// ===== SINGLE QUEUE EVENTS MONITOR =====
// Use one connection for monitoring all queues
let globalQueueEvents: QueueEvents | null = null;

export const createQueueEvents = (queueName: string) => {
  if (!globalQueueEvents) {
    // Create a single QueueEvents instance for all queues
    globalQueueEvents = new QueueEvents(queueName, {
      connection: connectionPool.getSubscriberConnection()
    });

    globalQueueEvents.on('completed', ({ jobId }) => {
      logger.debug(`Job ${jobId} in queue ${queueName} completed`);
    });

    globalQueueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job ${jobId} in queue ${queueName} failed`, { failedReason });
    });

    globalQueueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Job ${jobId} in queue ${queueName} progress`, { data });
    });
  }

  return globalQueueEvents;
};

// ===== HELPER FUNCTIONS =====
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

// ===== GRACEFUL SHUTDOWN =====
export const shutdownQueues = async () => {
  logger.info('Shutting down job queues...');
  
  const allQueues = Object.values(queues);
  
  // Close all queues
  await Promise.all(allQueues.map(queue => queue.close()));
  
  // Close global queue events
  if (globalQueueEvents) {
    await globalQueueEvents.close();
  }
  
  // Close all Redis connections
  await connectionPool.closeAll();
  
  logger.info('Job queues shut down successfully');
};

// ===== MONITORING =====
export const getRedisConnectionCount = () => {
  return connectionPool.getConnectionCount();
};

// Log connection count on startup
setTimeout(() => {
  logger.info(`Redis optimization active. Total connections: ${getRedisConnectionCount()}`);
}, 5000);