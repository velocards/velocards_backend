"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeScheduledJobs = initializeScheduledJobs;
exports.cleanupOldJobs = cleanupOldJobs;
exports.getRecurringJobsStatus = getRecurringJobsStatus;
const queue_1 = require("../../config/queue");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Initialize all recurring jobs
 */
async function initializeScheduledJobs() {
    try {
        logger_1.default.info('Initializing scheduled jobs...');
        // Transaction sync - every 5 minutes
        await (0, queue_1.addRecurringJob)(queue_1.queues.transactionSync, 'scheduled-full-sync', { fullSync: true }, '*/5 * * * *' // Every 5 minutes
        );
        // Card sync - every 10 minutes
        await (0, queue_1.addRecurringJob)(queue_1.queues.cardSync, 'scheduled-full-sync', { fullSync: true }, '*/10 * * * *' // Every 10 minutes
        );
        // Balance reconciliation - every hour
        await (0, queue_1.addRecurringJob)(queue_1.queues.balanceReconciliation, 'scheduled-reconciliation', { type: 'full' }, '0 * * * *' // Every hour at minute 0
        );
        // Crypto order sync - every 15 minutes
        await (0, queue_1.addRecurringJob)(queue_1.queues.cryptoOrderSync, 'scheduled-crypto-sync', { fullSync: true, maxAge: 24 }, '*/15 * * * *' // Every 15 minutes
        );
        // Crypto order check - every 30 minutes
        await (0, queue_1.addRecurringJob)(queue_1.queues.cryptoOrderCheck, 'scheduled-crypto-check', {
            checkStuckOrders: true,
            cleanupExpiredOrders: true,
            maxPendingHours: 2,
            maxOrderAgeDays: 7
        }, '*/30 * * * *' // Every 30 minutes
        );
        // Session cleanup - every 6 hours
        await (0, queue_1.addRecurringJob)(queue_1.queues.sessionCleanup, 'scheduled-session-cleanup', {
            cleanupExpiredSessions: true,
            cleanupInactiveSessions: true,
            maxInactiveHours: 24
        }, '0 */6 * * *' // Every 6 hours
        );
        // Session monitoring - every 2 hours
        await (0, queue_1.addRecurringJob)(queue_1.queues.sessionMonitoring, 'scheduled-session-monitoring', {
            generateReport: true,
            checkSuspiciousActivity: true,
            alertThresholds: {
                maxConcurrentSessions: 5,
                maxFailedLogins: 10,
                timeWindowMinutes: 60
            }
        }, '0 */2 * * *' // Every 2 hours
        );
        // Daily reports - at 2 AM every day
        await (0, queue_1.addRecurringJob)(queue_1.queues.dailyReports, 'scheduled-daily-report', { reportType: 'daily_summary' }, '0 2 * * *' // Daily at 2 AM
        );
        // Monthly fee processing - at 2 AM on the 1st of every month
        await (0, queue_1.addRecurringJob)(queue_1.queues.monthlyFeeProcessing, 'scheduled-monthly-fee-processing', { type: 'process_all_users' }, '0 2 1 * *' // At 02:00 on day 1 of every month
        );
        logger_1.default.info('All scheduled jobs initialized successfully');
    }
    catch (error) {
        logger_1.default.error('Failed to initialize scheduled jobs:', error);
        throw error;
    }
}
/**
 * Clean up old recurring jobs (useful when changing schedules)
 */
async function cleanupOldJobs() {
    try {
        logger_1.default.info('Cleaning up old recurring jobs...');
        for (const [name, queue] of Object.entries(queue_1.queues)) {
            const repeatableJobs = await queue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                await queue.removeRepeatableByKey(job.key);
                logger_1.default.info(`Removed old recurring job from ${name}:`, { jobName: job.name });
            }
        }
        logger_1.default.info('Old recurring jobs cleaned up');
    }
    catch (error) {
        logger_1.default.error('Failed to cleanup old jobs:', error);
        throw error;
    }
}
/**
 * Get status of all recurring jobs
 */
async function getRecurringJobsStatus() {
    const status = {};
    try {
        for (const [name, queue] of Object.entries(queue_1.queues)) {
            const repeatableJobs = await queue.getRepeatableJobs();
            status[name] = repeatableJobs.map(job => ({
                name: job.name,
                pattern: job.pattern,
                nextDate: job.next ? new Date(job.next).toISOString() : null
            }));
        }
        return status;
    }
    catch (error) {
        logger_1.default.error('Failed to get recurring jobs status:', error);
        throw error;
    }
}
//# sourceMappingURL=jobScheduler.js.map