import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { getAdmediacardsClient } from '../../integrations/admediacards';
import { supabase } from '../../config/database';
import logger from '../../utils/logger';
import { createRedisConnection } from '../../config/redis';

export interface BalanceReconciliationJobData {
  type: 'master_account' | 'user_balances' | 'full';
}

/**
 * Process balance reconciliation jobs
 * Ensures our balance records match actual balances
 */
export const createBalanceReconciliationWorker = () => {
  const connection = createRedisConnection();
  
  const worker = new Worker<BalanceReconciliationJobData>(
    QUEUE_NAMES.BALANCE_RECONCILIATION,
    async (job: Job<BalanceReconciliationJobData>) => {
      const { type } = job.data;
      
      logger.info('Starting balance reconciliation job', {
        jobId: job.id,
        type
      });
      
      try {
        await job.updateProgress(10);
        
        const results: any = {
          type,
          startedAt: new Date().toISOString(),
          discrepancies: []
        };
        
        if (type === 'master_account' || type === 'full') {
          // Reconcile master account balance
          await job.updateProgress(20);
          results.masterAccount = await reconcileMasterAccount();
        }
        
        if (type === 'user_balances' || type === 'full') {
          // Reconcile user balances
          await job.updateProgress(50);
          results.userBalances = await reconcileUserBalances(job);
        }
        
        await job.updateProgress(100);
        
        results.completedAt = new Date().toISOString();
        
        logger.info('Balance reconciliation job completed', {
          jobId: job.id,
          ...results
        });
        
        return results;
        
      } catch (error) {
        logger.error('Balance reconciliation job failed', {
          jobId: job.id,
          error
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 1 // Only one reconciliation at a time
    }
  );
  
  worker.on('completed', (job) => {
    logger.info(`Balance reconciliation job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Balance reconciliation job ${job?.id} failed:`, err);
  });
  
  return worker;
};

/**
 * Reconcile master account balance with Admediacards
 */
async function reconcileMasterAccount() {
  const admediacardsClient = getAdmediacardsClient();
  
  try {
    // Get master account balance from Admediacards
    const accountBalance = await admediacardsClient.getMasterAccountBalance();
    
    // Calculate expected balance from our active cards
    const { data: activeCards, error } = await supabase
      .from('virtual_cards')
      .select('remaining_balance')
      .eq('status', 'active');
      
    if (error) throw error;
    
    const ourTotalBalance = activeCards?.reduce((sum, card) => sum + (card.remaining_balance || 0), 0) || 0;
    
    // Check for discrepancy
    const difference = Math.abs(accountBalance - ourTotalBalance);
    const hasDiscrepancy = difference > 0.01; // Allow 1 cent tolerance
    
    // Update master account config
    const { error: updateError } = await supabase
      .from('master_account_config')
      .update({
        admediacards_balance: accountBalance,
        last_sync_at: new Date()
      })
      .eq('id', 1); // Assuming single master account
      
    if (updateError) throw updateError;
    
    if (hasDiscrepancy) {
      logger.warn('Master account balance discrepancy detected', {
        ourBalance: ourTotalBalance,
        providerBalance: accountBalance,
        difference
      });
    }
    
    return {
      providerBalance: accountBalance,
      calculatedBalance: ourTotalBalance,
      difference,
      hasDiscrepancy
    };
    
  } catch (error) {
    logger.error('Failed to reconcile master account', error);
    throw error;
  }
}

/**
 * Reconcile user balances with card totals
 */
async function reconcileUserBalances(job: Job) {
  const results = {
    totalUsers: 0,
    discrepancies: 0,
    corrections: 0
  };
  
  try {
    // Get all users with their virtual balance
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, virtual_balance')
      .gt('virtual_balance', 0);
      
    if (error) throw error;
    
    results.totalUsers = users?.length || 0;
    
    // Process each user
    for (let i = 0; i < (users?.length || 0); i++) {
      const user = users?.[i];
      if (!user) continue;
      
      const progress = 50 + (i / (users?.length || 1)) * 40;
      await job.updateProgress(progress);
      
      // Calculate user's actual balance from cards
      const { data: userCards, error: cardsError } = await supabase
        .from('virtual_cards')
        .select('remaining_balance')
        .eq('user_id', user.id)
        .eq('status', 'active');
        
      if (cardsError) {
        logger.error('Failed to get user cards', { userId: user.id, error: cardsError });
        continue;
      }
      
      const cardsTotalBalance = userCards?.reduce((sum: number, card: any) => sum + (card.remaining_balance || 0), 0) || 0;
      
      // Check for discrepancy
      const difference = Math.abs(user.virtual_balance - cardsTotalBalance);
      if (difference > 0.01) {
        results.discrepancies++;
        
        logger.warn('User balance discrepancy detected', {
          userId: user.id,
          virtualBalance: user.virtual_balance,
          cardsTotal: cardsTotalBalance,
          difference
        });
        
        // Create audit log entry
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'balance_discrepancy_detected',
            resource_type: 'user_balance',
            metadata: {
              virtual_balance: user.virtual_balance,
              cards_total: cardsTotalBalance,
              difference,
              job_id: job.id
            }
          });
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error('Failed to reconcile user balances', error);
    throw error;
  }
}