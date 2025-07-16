import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PasswordResetService } from '../../services/passwordResetService';
import { QUEUE_NAMES } from '../../config/queue';
import logger from '../../utils/logger';
import { env } from '../../config/env';

export class PasswordResetCleanupProcessor {
  static async process(_job: Job<any>): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Starting password reset token cleanup');

      await PasswordResetService.cleanupExpiredTokens();

      logger.info('Password reset token cleanup completed');
      return { 
        success: true, 
        message: 'Password reset token cleanup completed successfully' 
      };
    } catch (error) {
      logger.error('Password reset token cleanup failed', error);
      return { 
        success: false, 
        message: 'Password reset token cleanup failed' 
      };
    }
  }
}

/**
 * Create and configure the password reset cleanup worker
 */
export function createPasswordResetCleanupWorker(): Worker {
  const connection = new IORedis(env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });

  const worker = new Worker(
    QUEUE_NAMES.PASSWORD_RESET_CLEANUP,
    async (job: Job) => {
      return PasswordResetCleanupProcessor.process(job);
    },
    {
      connection,
      concurrency: 1,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 }
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Password reset cleanup job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Password reset cleanup job ${job?.id} failed:`, err);
  });

  return worker;
}