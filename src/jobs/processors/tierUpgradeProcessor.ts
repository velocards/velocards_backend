import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import tierService from '../../services/tierService';
import { supabase } from '../../config/database';
import logger from '../../utils/logger';
import { createRedisConnection } from '../../config/redis';

export interface TierUpgradeJobData {
  userId?: string; // If provided, check specific user. Otherwise check all
  reason?: string;
}

/**
 * Process tier upgrades based on spending and KYC status
 */
export const createTierUpgradeWorker = () => {
  const connection = createRedisConnection();
  
  const worker = new Worker<TierUpgradeJobData>(
    QUEUE_NAMES.TIER_UPGRADE,
    async (job: Job<TierUpgradeJobData>) => {
      const { userId, reason = 'scheduled_check' } = job.data;
      
      logger.info('Processing tier upgrade job', {
        jobId: job.id,
        userId,
        reason
      });
      
      try {
        let usersToCheck: string[] = [];
        
        if (userId) {
          // Check specific user
          usersToCheck = [userId];
        } else {
          // Get all active users
          const { data: users, error } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('account_status', 'active')
            .limit(1000); // Process in batches if needed
            
          if (error) throw error;
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
            const result = await tierService.checkAndUpdateUserTier(uid, reason);
            results.checked++;
            
            if (result.changed) {
              if (result.new_tier_id && result.previous_tier_id) {
                // Check if it's an upgrade or downgrade by comparing tier levels
                const { data: newTier } = await supabase
                  .from('user_tiers')
                  .select('tier_level')
                  .eq('id', result.new_tier_id)
                  .single();
                  
                const { data: oldTier } = await supabase
                  .from('user_tiers')
                  .select('tier_level')
                  .eq('id', result.previous_tier_id)
                  .single();
                  
                if (newTier && oldTier) {
                  if (newTier.tier_level > oldTier.tier_level) {
                    results.upgraded++;
                  } else {
                    results.downgraded++;
                  }
                } else {
                  results.unchanged++;
                }
              } else {
                // Initial tier assignment
                results.upgraded++;
              }
            } else {
              results.unchanged++;
            }
          } catch (error) {
            logger.error('Error processing tier for user', {
              userId: uid,
              error
            });
            results.errors++;
          }
        }
        
        logger.info('Tier upgrade job completed', {
          jobId: job.id,
          results
        });
        
        return results;
      } catch (error) {
        logger.error('Tier upgrade job failed', {
          jobId: job.id,
          error
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 3 // Process 3 tier checks concurrently
    }
  );
  
  worker.on('completed', (job) => {
    logger.info(`Tier upgrade job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Tier upgrade job ${job?.id} failed:`, err);
  });
  
  return worker;
};

/**
 * Schedule daily tier checks
 */
export const scheduleTierUpgrades = async () => {
  try {
    const { queues } = await import('../../config/queue');
    
    // Schedule daily tier check for all users
    await queues.tierUpgrade.add(
      'daily-check',
      { reason: 'daily_scheduled_check' },
      {
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
      }
    );
    
    logger.info('Scheduled daily tier upgrade checks');
  } catch (error) {
    logger.error('Failed to schedule tier upgrades', error);
  }
};