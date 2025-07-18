import Redis from 'ioredis';
import { redis as redisConfig } from './env';
import logger from '../utils/logger';

// Function to create a new Redis connection
export const createRedisConnection = () => {
  return new Redis(redisConfig.url, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    connectTimeout: 30000, // Increased for Railway
    disconnectTimeout: 5000,
    commandTimeout: 30000, // Increased for Railway
    keepAlive: 30000,
    lazyConnect: true, // Connect on demand
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

const redis = new Redis(redisConfig.url, {
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  connectTimeout: 30000, // Increased for Railway
  disconnectTimeout: 5000,
  commandTimeout: 30000, // Increased for Railway
  keepAlive: 30000,
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
    logger.error('Redis connection error:', error);
  }
});

redis.on('connect', () => {
  logger.info('✅ Redis connected successfully');
});

redis.on('ready', () => {
  logger.info('✅ Redis ready to accept commands');
});

export default redis;