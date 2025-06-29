import { queues, addRecurringJob } from '../../config/queue';
import logger from '../../utils/logger';

/**
 * Initialize all recurring jobs
 */
export async function initializeScheduledJobs() {
  try {
    logger.info('Initializing scheduled jobs...');

    // Transaction sync - every 5 minutes
    await addRecurringJob(
      queues.transactionSync,
      'scheduled-full-sync',
      { fullSync: true },
      '*/5 * * * *' // Every 5 minutes
    );

    // Card sync - every 10 minutes
    await addRecurringJob(
      queues.cardSync,
      'scheduled-full-sync',
      { fullSync: true },
      '*/10 * * * *' // Every 10 minutes
    );

    // Balance reconciliation - every hour
    await addRecurringJob(
      queues.balanceReconciliation,
      'scheduled-reconciliation',
      { type: 'full' },
      '0 * * * *' // Every hour at minute 0
    );

    // Crypto order sync - every 15 minutes
    await addRecurringJob(
      queues.cryptoOrderSync,
      'scheduled-crypto-sync',
      { fullSync: true, maxAge: 24 },
      '*/15 * * * *' // Every 15 minutes
    );

    // Crypto order check - every 30 minutes
    await addRecurringJob(
      queues.cryptoOrderCheck,
      'scheduled-crypto-check',
      { 
        checkStuckOrders: true, 
        cleanupExpiredOrders: true,
        maxPendingHours: 2,
        maxOrderAgeDays: 7
      },
      '*/30 * * * *' // Every 30 minutes
    );

    // Session cleanup - every 6 hours
    await addRecurringJob(
      queues.sessionCleanup,
      'scheduled-session-cleanup',
      { 
        cleanupExpiredSessions: true, 
        cleanupInactiveSessions: true,
        maxInactiveHours: 24
      },
      '0 */6 * * *' // Every 6 hours
    );

    // Session monitoring - every 2 hours
    await addRecurringJob(
      queues.sessionMonitoring,
      'scheduled-session-monitoring',
      { 
        generateReport: true, 
        checkSuspiciousActivity: true,
        alertThresholds: {
          maxConcurrentSessions: 5,
          maxFailedLogins: 10,
          timeWindowMinutes: 60
        }
      },
      '0 */2 * * *' // Every 2 hours
    );

    // Daily reports - at 2 AM every day
    await addRecurringJob(
      queues.dailyReports,
      'scheduled-daily-report',
      { reportType: 'daily_summary' },
      '0 2 * * *' // Daily at 2 AM
    );

    logger.info('All scheduled jobs initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize scheduled jobs:', error);
    throw error;
  }
}

/**
 * Clean up old recurring jobs (useful when changing schedules)
 */
export async function cleanupOldJobs() {
  try {
    logger.info('Cleaning up old recurring jobs...');

    for (const [name, queue] of Object.entries(queues)) {
      const repeatableJobs = await queue.getRepeatableJobs();
      
      for (const job of repeatableJobs) {
        await queue.removeRepeatableByKey(job.key);
        logger.info(`Removed old recurring job from ${name}:`, { jobName: job.name });
      }
    }

    logger.info('Old recurring jobs cleaned up');
  } catch (error) {
    logger.error('Failed to cleanup old jobs:', error);
    throw error;
  }
}

/**
 * Get status of all recurring jobs
 */
export async function getRecurringJobsStatus() {
  const status: Record<string, any[]> = {};

  try {
    for (const [name, queue] of Object.entries(queues)) {
      const repeatableJobs = await queue.getRepeatableJobs();
      status[name] = repeatableJobs.map(job => ({
        name: job.name,
        pattern: job.pattern,
        nextDate: job.next ? new Date(job.next).toISOString() : null
      }));
    }

    return status;
  } catch (error) {
    logger.error('Failed to get recurring jobs status:', error);
    throw error;
  }
}