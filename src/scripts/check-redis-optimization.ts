#!/usr/bin/env node

/**
 * Script to check Redis optimization status
 */

import { getRedisConnectionCount } from '../config/queue-optimized';
import redis from '../config/redis';

async function checkOptimization() {
  console.log('===== Redis Optimization Check =====\n');
  
  try {
    // Check optimized connection count
    console.log('✅ Optimized Queue Connections:', getRedisConnectionCount());
    console.log('   Expected: 3 (shared + subscriber + regular)\n');
    
    // Check Redis info
    const info = await redis.info('clients');
    const connectedClients = info.match(/connected_clients:(\d+)/)?.[1];
    console.log('📊 Total Redis Clients Connected:', connectedClients || 'Unknown');
    console.log('   Before optimization: ~32+');
    console.log('   After optimization: ~3-5\n');
    
    // Check memory usage
    const memInfo = await redis.info('memory');
    const usedMemory = memInfo.match(/used_memory_human:([^\r\n]+)/)?.[1];
    console.log('💾 Redis Memory Usage:', usedMemory || 'Unknown');
    
    // Check key count
    const dbSize = await redis.dbsize();
    console.log('🔑 Total Keys in Redis:', dbSize);
    
    // Sample some queue keys
    const queueKeys = await redis.keys('bull:*');
    console.log('📋 Bull Queue Keys:', queueKeys.length);
    
    console.log('\n✅ Optimization check complete!');
    
  } catch (error) {
    console.error('❌ Error checking optimization:', error);
  } finally {
    await redis.quit();
    process.exit(0);
  }
}

checkOptimization();