"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
const logger_1 = __importDefault(require("../utils/logger"));
// Function to create a new Redis connection
const createRedisConnection = () => {
    return new ioredis_1.default(env_1.redis.url, {
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        connectTimeout: 10000,
        disconnectTimeout: 2000,
        commandTimeout: 5000,
        keepAlive: 10000,
        reconnectOnError: (err) => {
            const targetError = 'READONLY';
            if (err.message.includes(targetError)) {
                // Reconnect on READONLY error
                return true;
            }
            return false;
        }
    });
};
exports.createRedisConnection = createRedisConnection;
const redis = new ioredis_1.default(env_1.redis.url, {
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    connectTimeout: 10000,
    disconnectTimeout: 2000,
    commandTimeout: 5000,
    keepAlive: 10000,
    reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
            // Reconnect on READONLY error
            return true;
        }
        return false;
    }
});
redis.on('error', (error) => {
    // Only log if it's not a connection reset error
    if (!error.message?.includes('ECONNRESET')) {
        logger_1.default.error('Redis connection error:', error);
    }
});
redis.on('connect', () => {
    logger_1.default.info('✅ Redis connected successfully');
});
redis.on('ready', () => {
    logger_1.default.info('✅ Redis ready to accept commands');
});
exports.default = redis;
//# sourceMappingURL=redis.js.map