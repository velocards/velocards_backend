"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processSessionCleanup = void 0;
exports.createSessionCleanupWorker = createSessionCleanupWorker;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const redis_1 = require("../../config/redis");
const redis_2 = __importDefault(require("../../config/redis"));
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Process session cleanup jobs
 */
const processSessionCleanup = async (job) => {
    const { cleanupExpiredSessions, cleanupInactiveSessions, maxInactiveHours = 24 } = job.data;
    logger_1.default.info('Starting session cleanup job', {
        cleanupExpiredSessions,
        cleanupInactiveSessions,
        maxInactiveHours
    });
    let cleanedCount = 0;
    try {
        // Check if Redis is available and connected
        try {
            await redis_2.default.ping();
        }
        catch (redisError) {
            logger_1.default.warn('Redis unavailable, skipping session cleanup', { error: redisError.message });
            return { success: false, reason: 'Redis unavailable', cleanedCount: 0 };
        }
        // Cleanup expired sessions
        if (cleanupExpiredSessions) {
            const expiredCount = await cleanupExpiredRedisKeys();
            cleanedCount += expiredCount;
            logger_1.default.info(`Cleaned up ${expiredCount} expired sessions`);
        }
        // Cleanup inactive sessions
        if (cleanupInactiveSessions) {
            const inactiveCount = await cleanupInactiveUserSessions(maxInactiveHours);
            cleanedCount += inactiveCount;
            logger_1.default.info(`Cleaned up ${inactiveCount} inactive sessions`);
        }
        logger_1.default.info('Session cleanup completed successfully', { cleanedCount });
        return {
            success: true,
            cleanedCount,
            expiredSessions: cleanupExpiredSessions,
            inactiveSessions: cleanupInactiveSessions
        };
    }
    catch (error) {
        logger_1.default.error('Session cleanup job failed', { error: error.message });
        throw error;
    }
};
exports.processSessionCleanup = processSessionCleanup;
/**
 * Clean up expired Redis keys (Redis handles this automatically, but we can force scan)
 */
async function cleanupExpiredRedisKeys() {
    try {
        let cursor = '0';
        let deletedCount = 0;
        const sessionPattern = 'session:*';
        do {
            const [nextCursor, keys] = await redis_2.default.scan(cursor, 'MATCH', sessionPattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                // Check TTL for each key and delete expired ones
                const pipeline = redis_2.default.pipeline();
                for (const key of keys) {
                    pipeline.ttl(key);
                }
                const ttlResults = await pipeline.exec();
                if (ttlResults) {
                    const expiredKeys = keys.filter((_, index) => {
                        const result = ttlResults[index];
                        if (!result)
                            return false;
                        const [err, ttl] = result;
                        return !err && (ttl === -2 || ttl === 0); // -2 means key doesn't exist, 0 means expired
                    });
                    if (expiredKeys.length > 0) {
                        await redis_2.default.del(...expiredKeys);
                        deletedCount += expiredKeys.length;
                    }
                }
            }
        } while (cursor !== '0');
        return deletedCount;
    }
    catch (error) {
        logger_1.default.error('Error cleaning expired Redis keys', { error: error.message });
        return 0;
    }
}
/**
 * Clean up sessions that haven't been accessed for specified hours
 */
async function cleanupInactiveUserSessions(maxInactiveHours) {
    try {
        const cutoffTime = Date.now() - (maxInactiveHours * 60 * 60 * 1000);
        let cursor = '0';
        let deletedCount = 0;
        const sessionPattern = 'session:*';
        do {
            const [nextCursor, keys] = await redis_2.default.scan(cursor, 'MATCH', sessionPattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                const pipeline = redis_2.default.pipeline();
                // Get session data to check last activity
                for (const key of keys) {
                    pipeline.get(key);
                }
                const sessionResults = await pipeline.exec();
                if (sessionResults) {
                    const inactiveKeys = [];
                    for (let i = 0; i < keys.length; i++) {
                        const result = sessionResults[i];
                        if (!result)
                            continue;
                        const [err, sessionData] = result;
                        if (!err && sessionData) {
                            try {
                                const session = JSON.parse(sessionData);
                                const lastActivity = session.lastActivity || session.createdAt;
                                if (lastActivity && new Date(lastActivity).getTime() < cutoffTime) {
                                    inactiveKeys.push(keys[i]);
                                }
                            }
                            catch (parseError) {
                                // If we can't parse the session, consider it invalid and remove it
                                inactiveKeys.push(keys[i]);
                            }
                        }
                    }
                    if (inactiveKeys.length > 0) {
                        const validKeys = inactiveKeys.filter(key => key !== undefined);
                        if (validKeys.length > 0) {
                            await redis_2.default.del(...validKeys);
                            deletedCount += validKeys.length;
                        }
                    }
                }
            }
        } while (cursor !== '0');
        return deletedCount;
    }
    catch (error) {
        logger_1.default.error('Error cleaning inactive sessions', { error: error.message });
        return 0;
    }
}
/**
 * Create and export session cleanup worker
 */
function createSessionCleanupWorker() {
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.SESSION_CLEANUP, exports.processSessionCleanup, {
        connection: (0, redis_1.createRedisConnection)(),
        concurrency: 1, // Single worker for session cleanup
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 }
    });
    worker.on('completed', (job) => {
        logger_1.default.info(`Session cleanup job ${job.id} completed`, { result: job.returnvalue });
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Session cleanup job ${job?.id} failed`, { error: err.message });
    });
    return worker;
}
//# sourceMappingURL=sessionCleanupProcessor.js.map