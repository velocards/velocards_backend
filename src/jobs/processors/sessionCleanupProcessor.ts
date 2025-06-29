import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { createRedisConnection } from '../../config/redis';
import redis from '../../config/redis';
import logger from '../../utils/logger';

interface SessionCleanupJobData {
  cleanupExpiredSessions: boolean;
  cleanupInactiveSessions: boolean;
  maxInactiveHours?: number;
}

/**
 * Process session cleanup jobs
 */
export const processSessionCleanup = async (job: Job<SessionCleanupJobData>) => {
  const { cleanupExpiredSessions, cleanupInactiveSessions, maxInactiveHours = 24 } = job.data;
  
  logger.info('Starting session cleanup job', { 
    cleanupExpiredSessions, 
    cleanupInactiveSessions, 
    maxInactiveHours 
  });

  let cleanedCount = 0;

  try {
    // Check if Redis is available and connected
    try {
      await redis.ping();
    } catch (redisError) {
      logger.warn('Redis unavailable, skipping session cleanup', { error: (redisError as Error).message });
      return { success: false, reason: 'Redis unavailable', cleanedCount: 0 };
    }

    // Cleanup expired sessions
    if (cleanupExpiredSessions) {
      const expiredCount = await cleanupExpiredRedisKeys();
      cleanedCount += expiredCount;
      logger.info(`Cleaned up ${expiredCount} expired sessions`);
    }

    // Cleanup inactive sessions
    if (cleanupInactiveSessions) {
      const inactiveCount = await cleanupInactiveUserSessions(maxInactiveHours);
      cleanedCount += inactiveCount;
      logger.info(`Cleaned up ${inactiveCount} inactive sessions`);
    }

    logger.info('Session cleanup completed successfully', { cleanedCount });
    return { 
      success: true, 
      cleanedCount,
      expiredSessions: cleanupExpiredSessions,
      inactiveSessions: cleanupInactiveSessions
    };

  } catch (error: any) {
    logger.error('Session cleanup job failed', { error: error.message });
    throw error;
  }
};

/**
 * Clean up expired Redis keys (Redis handles this automatically, but we can force scan)
 */
async function cleanupExpiredRedisKeys(): Promise<number> {
  try {

    let cursor = '0';
    let deletedCount = 0;
    const sessionPattern = 'session:*';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', sessionPattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        // Check TTL for each key and delete expired ones
        const pipeline = redis.pipeline();
        
        for (const key of keys) {
          pipeline.ttl(key);
        }
        
        const ttlResults = await pipeline.exec();
        
        if (ttlResults) {
          const expiredKeys = keys.filter((_: string, index: number) => {
            const result = ttlResults[index];
            if (!result) return false;
            const [err, ttl] = result;
            return !err && (ttl === -2 || ttl === 0); // -2 means key doesn't exist, 0 means expired
          });

          if (expiredKeys.length > 0) {
            await redis.del(...expiredKeys);
            deletedCount += expiredKeys.length;
          }
        }
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (error: any) {
    logger.error('Error cleaning expired Redis keys', { error: error.message });
    return 0;
  }
}

/**
 * Clean up sessions that haven't been accessed for specified hours
 */
async function cleanupInactiveUserSessions(maxInactiveHours: number): Promise<number> {
  try {

    const cutoffTime = Date.now() - (maxInactiveHours * 60 * 60 * 1000);
    let cursor = '0';
    let deletedCount = 0;
    const sessionPattern = 'session:*';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', sessionPattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        
        // Get session data to check last activity
        for (const key of keys) {
          pipeline.get(key);
        }
        
        const sessionResults = await pipeline.exec();
        
        if (sessionResults) {
          const inactiveKeys = [];
          
          for (let i = 0; i < keys.length; i++) {
            const result = sessionResults[i];
            if (!result) continue;
            const [err, sessionData] = result;
            
            if (!err && sessionData) {
              try {
                const session = JSON.parse(sessionData as string);
                const lastActivity = session.lastActivity || session.createdAt;
                
                if (lastActivity && new Date(lastActivity).getTime() < cutoffTime) {
                  inactiveKeys.push(keys[i]);
                }
              } catch (parseError) {
                // If we can't parse the session, consider it invalid and remove it
                inactiveKeys.push(keys[i]);
              }
            }
          }

          if (inactiveKeys.length > 0) {
            const validKeys = inactiveKeys.filter(key => key !== undefined) as string[];
            if (validKeys.length > 0) {
              await redis.del(...validKeys);
              deletedCount += validKeys.length;
            }
          }
        }
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (error: any) {
    logger.error('Error cleaning inactive sessions', { error: error.message });
    return 0;
  }
}

/**
 * Create and export session cleanup worker
 */
export function createSessionCleanupWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.SESSION_CLEANUP,
    processSessionCleanup,
    {
      connection: createRedisConnection(),
      concurrency: 1, // Single worker for session cleanup
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 }
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Session cleanup job ${job.id} completed`, { result: job.returnvalue });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Session cleanup job ${job?.id} failed`, { error: err.message });
  });

  return worker;
}