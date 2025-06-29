"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleTierUpgrades = exports.createTierUpgradeWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const tierService_1 = __importDefault(require("../../services/tierService"));
const database_1 = require("../../config/database");
const logger_1 = __importDefault(require("../../utils/logger"));
const redis_1 = require("../../config/redis");
/**
 * Process tier upgrades based on spending and KYC status
 */
const createTierUpgradeWorker = () => {
    const connection = (0, redis_1.createRedisConnection)();
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.TIER_UPGRADE, async (job) => {
        const { userId, reason = 'scheduled_check' } = job.data;
        logger_1.default.info('Processing tier upgrade job', {
            jobId: job.id,
            userId,
            reason
        });
        try {
            let usersToCheck = [];
            if (userId) {
                // Check specific user
                usersToCheck = [userId];
            }
            else {
                // Get all active users
                const { data: users, error } = await database_1.supabase
                    .from('user_profiles')
                    .select('id')
                    .eq('account_status', 'active')
                    .limit(1000); // Process in batches if needed
                if (error)
                    throw error;
                usersToCheck = users?.map(u => u.id) || [];
            }
            const results = {
                checked: 0,
                upgraded: 0,
                downgraded: 0,
                unchanged: 0,
                errors: 0
            };
            // Process each user
            for (const uid of usersToCheck) {
                try {
                    const result = await tierService_1.default.checkAndUpdateUserTier(uid, reason);
                    results.checked++;
                    if (result.changed) {
                        if (result.new_tier_id && result.previous_tier_id) {
                            // Check if it's an upgrade or downgrade by comparing tier levels
                            const { data: newTier } = await database_1.supabase
                                .from('user_tiers')
                                .select('tier_level')
                                .eq('id', result.new_tier_id)
                                .single();
                            const { data: oldTier } = await database_1.supabase
                                .from('user_tiers')
                                .select('tier_level')
                                .eq('id', result.previous_tier_id)
                                .single();
                            if (newTier && oldTier) {
                                if (newTier.tier_level > oldTier.tier_level) {
                                    results.upgraded++;
                                }
                                else {
                                    results.downgraded++;
                                }
                            }
                            else {
                                results.unchanged++;
                            }
                        }
                        else {
                            // Initial tier assignment
                            results.upgraded++;
                        }
                    }
                    else {
                        results.unchanged++;
                    }
                }
                catch (error) {
                    logger_1.default.error('Error processing tier for user', {
                        userId: uid,
                        error
                    });
                    results.errors++;
                }
            }
            logger_1.default.info('Tier upgrade job completed', {
                jobId: job.id,
                results
            });
            return results;
        }
        catch (error) {
            logger_1.default.error('Tier upgrade job failed', {
                jobId: job.id,
                error
            });
            throw error;
        }
    }, {
        connection,
        concurrency: 3 // Process 3 tier checks concurrently
    });
    worker.on('completed', (job) => {
        logger_1.default.info(`Tier upgrade job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Tier upgrade job ${job?.id} failed:`, err);
    });
    return worker;
};
exports.createTierUpgradeWorker = createTierUpgradeWorker;
/**
 * Schedule daily tier checks
 */
const scheduleTierUpgrades = async () => {
    try {
        const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
        // Schedule daily tier check for all users
        await queues.tierUpgrade.add('daily-check', { reason: 'daily_scheduled_check' }, {
            repeat: {
                pattern: '0 2 * * *' // Run at 2 AM daily
            },
            removeOnComplete: {
                age: 24 * 3600, // Keep completed jobs for 24 hours
                count: 7 // Keep last 7 completed jobs
            },
            removeOnFail: {
                age: 7 * 24 * 3600 // Keep failed jobs for 7 days
            }
        });
        logger_1.default.info('Scheduled daily tier upgrade checks');
    }
    catch (error) {
        logger_1.default.error('Failed to schedule tier upgrades', error);
    }
};
exports.scheduleTierUpgrades = scheduleTierUpgrades;
//# sourceMappingURL=tierUpgradeProcessor.js.map