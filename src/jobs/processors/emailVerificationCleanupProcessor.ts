import { Worker, Job } from 'bullmq';
import { EmailVerificationService } from '../../services/emailVerificationService';
import { QUEUE_NAMES } from '../../config/queue';
import { createRedisConnection } from '../../config/redis';
import logger from '../../utils/logger';

interface EmailVerificationCleanupJobData {
  timestamp: string;
}

export async function processEmailVerificationCleanup(
  job: Job<EmailVerificationCleanupJobData>
): Promise<{ success: boolean; deletedCount: number }> {
  try {
    logger.info('Starting email verification token cleanup', {
      jobId: job.id,
      timestamp: job.data.timestamp
    });

    const deletedCount = await EmailVerificationService.cleanupExpiredTokens();

    logger.info('Email verification token cleanup completed', {
      jobId: job.id,
      deletedCount
    });

    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    logger.error('Email verification token cleanup failed:', {
      error,
      jobId: job.id
    });

    // Return failure result instead of throwing
    return {
      success: false,
      deletedCount: 0
    };
  }
}

export function createEmailVerificationCleanupWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker(
    QUEUE_NAMES.EMAIL_VERIFICATION_CLEANUP,
    processEmailVerificationCleanup,
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 1000 // 1 job per second
      }
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('Email verification cleanup job completed', {
      jobId: job.id,
      result
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Email verification cleanup job failed', {
      jobId: job?.id,
      error: err.message
    });
  });

  return worker;
}