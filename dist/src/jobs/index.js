"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobWorkers = startJobWorkers;
exports.stopJobWorkers = stopJobWorkers;
exports.getWorkerStatus = getWorkerStatus;
const transactionSyncProcessor_1 = require("./processors/transactionSyncProcessor");
const cardSyncProcessor_1 = require("./processors/cardSyncProcessor");
const balanceReconciliationProcessor_1 = require("./processors/balanceReconciliationProcessor");
const webhookProcessor_1 = require("./processors/webhookProcessor");
const cryptoOrderSyncProcessor_1 = require("./processors/cryptoOrderSyncProcessor");
const cryptoOrderCheckProcessor_1 = require("./processors/cryptoOrderCheckProcessor");
const userBalanceUpdateProcessor_1 = require("./processors/userBalanceUpdateProcessor");
const sessionCleanupProcessor_1 = require("./processors/sessionCleanupProcessor");
const sessionMonitoringProcessor_1 = require("./processors/sessionMonitoringProcessor");
const tierUpgradeProcessor_1 = require("./processors/tierUpgradeProcessor");
const monthlyFeeProcessor_1 = require("./processors/monthlyFeeProcessor");
const invoiceProcessor_1 = require("./processors/invoiceProcessor");
const jobScheduler_1 = require("./schedulers/jobScheduler");
const queue_1 = require("../config/queue");
const logger_1 = __importDefault(require("../utils/logger"));
let workers = [];
let queueEvents = [];
/**
 * Start all job workers
 */
async function startJobWorkers() {
    try {
        logger_1.default.info('Starting job workers...');
        // Create workers
        workers = [
            (0, transactionSyncProcessor_1.createTransactionSyncWorker)(),
            (0, cardSyncProcessor_1.createCardSyncWorker)(),
            (0, balanceReconciliationProcessor_1.createBalanceReconciliationWorker)(),
            (0, webhookProcessor_1.createWebhookWorker)(),
            (0, cryptoOrderSyncProcessor_1.createCryptoOrderSyncWorker)(),
            (0, cryptoOrderCheckProcessor_1.createCryptoOrderCheckWorker)(),
            (0, userBalanceUpdateProcessor_1.createUserBalanceUpdateWorker)(),
            (0, sessionCleanupProcessor_1.createSessionCleanupWorker)(),
            (0, sessionMonitoringProcessor_1.createSessionMonitoringWorker)(),
            (0, tierUpgradeProcessor_1.createTierUpgradeWorker)(),
            (0, monthlyFeeProcessor_1.createMonthlyFeeWorker)(),
            (0, invoiceProcessor_1.createInvoiceWorker)()
        ];
        // Create queue event listeners for monitoring
        queueEvents = Object.values(queue_1.QUEUE_NAMES).map(queueName => (0, queue_1.createQueueEvents)(queueName));
        // Initialize scheduled jobs
        if (process.env['ENABLE_SCHEDULED_JOBS'] !== 'false') {
            // Clean up old jobs first (in case cron patterns changed)
            await (0, jobScheduler_1.cleanupOldJobs)();
            // Initialize new scheduled jobs
            await (0, jobScheduler_1.initializeScheduledJobs)();
            // Schedule tier upgrades
            await (0, tierUpgradeProcessor_1.scheduleTierUpgrades)();
        }
        logger_1.default.info(`Started ${workers.length} job workers`);
    }
    catch (error) {
        logger_1.default.error('Failed to start job workers:', error);
        throw error;
    }
}
/**
 * Stop all job workers gracefully
 */
async function stopJobWorkers() {
    try {
        logger_1.default.info('Stopping job workers...');
        // Close all workers
        await Promise.all(workers.map(worker => worker.close()));
        // Close all queue event listeners
        await Promise.all(queueEvents.map(qe => qe.close()));
        // Clear arrays
        workers = [];
        queueEvents = [];
        logger_1.default.info('All job workers stopped');
    }
    catch (error) {
        logger_1.default.error('Error stopping job workers:', error);
        throw error;
    }
}
/**
 * Get worker status
 */
function getWorkerStatus() {
    return workers.map(worker => ({
        name: worker.name,
        isRunning: worker.isRunning(),
        isPaused: worker.isPaused(),
        concurrency: worker.concurrency
    }));
}
//# sourceMappingURL=index.js.map