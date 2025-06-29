import { Worker } from 'bullmq';
import { createTransactionSyncWorker } from './processors/transactionSyncProcessor';
import { createCardSyncWorker } from './processors/cardSyncProcessor';
import { createBalanceReconciliationWorker } from './processors/balanceReconciliationProcessor';
import { createWebhookWorker } from './processors/webhookProcessor';
import { createCryptoOrderSyncWorker } from './processors/cryptoOrderSyncProcessor';
import { createCryptoOrderCheckWorker } from './processors/cryptoOrderCheckProcessor';
import { createUserBalanceUpdateWorker } from './processors/userBalanceUpdateProcessor';
import { createSessionCleanupWorker } from './processors/sessionCleanupProcessor';
import { createSessionMonitoringWorker } from './processors/sessionMonitoringProcessor';
import { createTierUpgradeWorker, scheduleTierUpgrades } from './processors/tierUpgradeProcessor';
import { initializeScheduledJobs, cleanupOldJobs } from './schedulers/jobScheduler';
import { createQueueEvents, QUEUE_NAMES } from '../config/queue';
import logger from '../utils/logger';

let workers: Worker[] = [];
let queueEvents: any[] = [];

/**
 * Start all job workers
 */
export async function startJobWorkers() {
  try {
    logger.info('Starting job workers...');

    // Create workers
    workers = [
      createTransactionSyncWorker(),
      createCardSyncWorker(),
      createBalanceReconciliationWorker(),
      createWebhookWorker(),
      createCryptoOrderSyncWorker(),
      createCryptoOrderCheckWorker(),
      createUserBalanceUpdateWorker(),
      createSessionCleanupWorker(),
      createSessionMonitoringWorker(),
      createTierUpgradeWorker()
    ];

    // Create queue event listeners for monitoring
    queueEvents = Object.values(QUEUE_NAMES).map(queueName => 
      createQueueEvents(queueName)
    );

    // Initialize scheduled jobs
    if (process.env['ENABLE_SCHEDULED_JOBS'] !== 'false') {
      // Clean up old jobs first (in case cron patterns changed)
      await cleanupOldJobs();
      
      // Initialize new scheduled jobs
      await initializeScheduledJobs();
      
      // Schedule tier upgrades
      await scheduleTierUpgrades();
    }

    logger.info(`Started ${workers.length} job workers`);
  } catch (error) {
    logger.error('Failed to start job workers:', error);
    throw error;
  }
}

/**
 * Stop all job workers gracefully
 */
export async function stopJobWorkers() {
  try {
    logger.info('Stopping job workers...');

    // Close all workers
    await Promise.all(workers.map(worker => worker.close()));

    // Close all queue event listeners
    await Promise.all(queueEvents.map(qe => qe.close()));

    // Clear arrays
    workers = [];
    queueEvents = [];

    logger.info('All job workers stopped');
  } catch (error) {
    logger.error('Error stopping job workers:', error);
    throw error;
  }
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return workers.map(worker => ({
    name: worker.name,
    isRunning: worker.isRunning(),
    isPaused: worker.isPaused(),
    concurrency: worker.concurrency
  }));
}