import Bull from 'bull';
import { EmailOptions, EmailQueueItem } from './types';
import { createRedisConnection } from '../../config/redis';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Email Queue for handling retries and delayed sending
 */
export class EmailQueue {
  private queue: Bull.Queue<EmailQueueItem>;
  private readonly queueName = 'email-queue';

  constructor() {
    // Initialize Bull queue with Redis connection
    const redisClient = createRedisConnection();
    
    this.queue = new Bull(this.queueName, {
      createClient: () => redisClient,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000 // Start with 2 second delay
        }
      }
    });

    logger.info('Email queue initialized');
  }

  /**
   * Add an email to the queue
   */
  async enqueue(
    options: EmailOptions, 
    config?: {
      delay?: number;
      priority?: number;
      maxRetries?: number;
    }
  ): Promise<string> {
    const queueItem: EmailQueueItem = {
      id: uuidv4(),
      options,
      retryCount: 0,
      maxRetries: config?.maxRetries || 3,
      createdAt: new Date(),
      status: 'pending'
    };

    const job = await this.queue.add(queueItem, {
      delay: config?.delay,
      priority: config?.priority,
      attempts: config?.maxRetries || 3
    });

    logger.info('Email added to queue', {
      queueItemId: queueItem.id,
      jobId: job.id,
      to: options.to,
      subject: options.subject,
      delay: config?.delay
    });

    return queueItem.id;
  }

  /**
   * Process queue items
   */
  async process(handler: (item: EmailQueueItem) => Promise<void>): Promise<void> {
    this.queue.process(async (job) => {
      const item = job.data;
      
      try {
        logger.info('Processing queued email', {
          queueItemId: item.id,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts
        });

        item.status = 'processing';
        item.retryCount = job.attemptsMade;

        await handler(item);

        item.status = 'sent';
        
        logger.info('Queued email processed successfully', {
          queueItemId: item.id,
          attempts: job.attemptsMade + 1
        });

      } catch (error: any) {
        item.status = 'failed';
        item.error = error.message;

        logger.error('Failed to process queued email', {
          queueItemId: item.id,
          attempt: job.attemptsMade + 1,
          error: error.message
        });

        // Re-throw to trigger Bull's retry mechanism
        throw error;
      }
    });
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed
    };
  }

  /**
   * Get failed jobs for monitoring
   */
  async getFailedJobs(limit = 10): Promise<EmailQueueItem[]> {
    const failedJobs = await this.queue.getFailed(0, limit);
    
    return failedJobs.map(job => ({
      ...job.data,
      error: job.failedReason
    }));
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    
    logger.info('Retrying failed email job', {
      jobId,
      queueItemId: job.data.id
    });
  }

  /**
   * Clear completed jobs
   */
  async clearCompleted(): Promise<void> {
    const completed = await this.queue.getCompleted();
    
    for (const job of completed) {
      await job.remove();
    }

    logger.info(`Cleared ${completed.length} completed email jobs`);
  }

  /**
   * Clear failed jobs
   */
  async clearFailed(): Promise<void> {
    const failed = await this.queue.getFailed();
    
    for (const job of failed) {
      await job.remove();
    }

    logger.info(`Cleared ${failed.length} failed email jobs`);
  }

  /**
   * Gracefully shutdown the queue
   */
  async shutdown(): Promise<void> {
    await this.queue.close();
    logger.info('Email queue shut down');
  }
}