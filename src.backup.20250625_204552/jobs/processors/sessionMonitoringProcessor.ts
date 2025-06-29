import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { createRedisConnection } from '../../config/redis';
import redis from '../../config/redis';
import logger from '../../utils/logger';

interface SessionMonitoringJobData {
  generateReport: boolean;
  checkSuspiciousActivity: boolean;
  alertThresholds?: {
    maxConcurrentSessions?: number;
    maxFailedLogins?: number;
    timeWindowMinutes?: number;
  };
}

interface SessionStats {
  totalActiveSessions: number;
  sessionsByUser: Record<string, number>;
  suspiciousUsers: string[];
  oldestSession?: {
    userId: string;
    createdAt: Date;
    ageHours: number;
  };
  newestSession?: {
    userId: string;
    createdAt: Date;
  };
}

/**
 * Process session monitoring jobs
 */
export const processSessionMonitoring = async (job: Job<SessionMonitoringJobData>) => {
  const { 
    generateReport, 
    checkSuspiciousActivity, 
    alertThresholds = {
      maxConcurrentSessions: 5,
      maxFailedLogins: 10,
      timeWindowMinutes: 60
    }
  } = job.data;
  
  logger.info('Starting session monitoring job', { 
    generateReport, 
    checkSuspiciousActivity,
    alertThresholds
  });

  try {
    // Check if Redis is available and connected
    try {
      await redis.ping();
    } catch (redisError) {
      logger.warn('Redis unavailable, skipping session monitoring', { error: (redisError as Error).message });
      return { success: false, reason: 'Redis unavailable' };
    }

    const results: any = { success: true };

    // Generate session report
    if (generateReport) {
      const sessionStats = await generateSessionReport();
      results.sessionStats = sessionStats;
      logger.info('Session report generated', sessionStats);
    }

    // Check for suspicious activity
    if (checkSuspiciousActivity) {
      const suspiciousActivity = await checkForSuspiciousActivity(alertThresholds);
      results.suspiciousActivity = suspiciousActivity;
      
      if (suspiciousActivity.alerts.length > 0) {
        logger.warn('Suspicious session activity detected', suspiciousActivity);
      }
    }

    logger.info('Session monitoring completed successfully');
    return results;

  } catch (error: any) {
    logger.error('Session monitoring job failed', { error: error.message });
    throw error;
  }
};

/**
 * Generate comprehensive session statistics
 */
async function generateSessionReport(): Promise<SessionStats> {
  try {

    let cursor = '0';
    const sessionsByUser: Record<string, number> = {};
    const sessionDetails: Array<{ userId: string; createdAt: Date }> = [];
    const sessionPattern = 'session:*';

    // Scan all session keys
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', sessionPattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        
        // Get all session data
        for (const key of keys) {
          pipeline.get(key);
        }
        
        const sessionResults = await pipeline.exec();
        
        if (sessionResults) {
          for (let i = 0; i < keys.length; i++) {
            const result = sessionResults[i];
            if (!result) continue;
            const [err, sessionData] = result;
            
            if (!err && sessionData) {
              try {
                const session = JSON.parse(sessionData as string);
                const userId = session.userId;
                
                if (userId) {
                  // Count sessions per user
                  sessionsByUser[userId] = (sessionsByUser[userId] || 0) + 1;
                  
                  // Track session details for age analysis
                  if (session.createdAt) {
                    sessionDetails.push({
                      userId,
                      createdAt: new Date(session.createdAt)
                    });
                  }
                }
              } catch (parseError) {
                logger.warn('Failed to parse session data', { key: keys[i] });
              }
            }
          }
        }
      }
    } while (cursor !== '0');

    // Find oldest and newest sessions
    const sortedSessions = sessionDetails.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const oldestSession = sortedSessions[0];
    const newestSession = sortedSessions[sortedSessions.length - 1];

    // Identify users with suspicious number of concurrent sessions
    const suspiciousUsers = Object.entries(sessionsByUser)
      .filter(([_, count]) => count > 3) // More than 3 concurrent sessions
      .map(([userId]) => userId);

    const stats: SessionStats = {
      totalActiveSessions: sessionDetails.length,
      sessionsByUser,
      suspiciousUsers
    };

    if (oldestSession) {
      stats.oldestSession = {
        userId: oldestSession.userId,
        createdAt: oldestSession.createdAt,
        ageHours: (Date.now() - oldestSession.createdAt.getTime()) / (1000 * 60 * 60)
      };
    }

    if (newestSession) {
      stats.newestSession = {
        userId: newestSession.userId,
        createdAt: newestSession.createdAt
      };
    }

    return stats;
  } catch (error: any) {
    logger.error('Error generating session report', { error: error.message });
    throw error;
  }
}

/**
 * Check for suspicious session activity
 */
async function checkForSuspiciousActivity(thresholds: any) {
  try {

    const alerts: Array<{ type: string; userId: string; details: any }> = [];
    let cursor = '0';
    const sessionsByUser: Record<string, number> = {};
    const sessionPattern = 'session:*';

    // Count sessions per user
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', sessionPattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        
        for (const key of keys) {
          pipeline.get(key);
        }
        
        const sessionResults = await pipeline.exec();
        
        if (sessionResults) {
          for (let i = 0; i < keys.length; i++) {
            const result = sessionResults[i];
            if (!result) continue;
            const [err, sessionData] = result;
            
            if (!err && sessionData) {
              try {
                const session = JSON.parse(sessionData as string);
                const userId = session.userId;
                
                if (userId) {
                  sessionsByUser[userId] = (sessionsByUser[userId] || 0) + 1;
                }
              } catch (parseError) {
                // Skip invalid sessions
              }
            }
          }
        }
      }
    } while (cursor !== '0');

    // Check for users with too many concurrent sessions
    for (const [userId, sessionCount] of Object.entries(sessionsByUser)) {
      if (sessionCount > thresholds.maxConcurrentSessions) {
        alerts.push({
          type: 'excessive_concurrent_sessions',
          userId,
          details: {
            sessionCount,
            threshold: thresholds.maxConcurrentSessions
          }
        });
      }
    }

    // TODO: Check for failed login attempts (would need to be tracked separately)
    // This is a placeholder for future implementation of failed login tracking

    return {
      alerts,
      totalUsersWithSessions: Object.keys(sessionsByUser).length,
      averageSessionsPerUser: Object.values(sessionsByUser).reduce((a, b) => a + b, 0) / Object.keys(sessionsByUser).length || 0
    };
  } catch (error: any) {
    logger.error('Error checking suspicious activity', { error: error.message });
    throw error;
  }
}

/**
 * Create and export session monitoring worker
 */
export function createSessionMonitoringWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.SESSION_MONITORING,
    processSessionMonitoring,
    {
      connection: createRedisConnection(),
      concurrency: 1, // Single worker for monitoring
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 }
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Session monitoring job ${job.id} completed`, { result: job.returnvalue });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Session monitoring job ${job?.id} failed`, { error: err.message });
  });

  return worker;
}