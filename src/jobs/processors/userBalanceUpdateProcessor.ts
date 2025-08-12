import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { createRedisConnection } from '../../config/redis';
import { UserRepository } from '../../repositories/userRepository';
import { UserBalanceLedgerRepository } from '../../repositories/UserBalanceLedgerRepository';
import { CryptoTransactionRepository } from '../../repositories/cryptoTransactionRepository';
import logger from '../../utils/logger';

export interface UserBalanceUpdateJobData {
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: 'crypto_deposit_completed' | 'card_funding' | 'refund' | 'fee' | 'adjustment' | 'withdrawal';
  referenceType?: string; // e.g., 'crypto_transaction', 'card_creation'
  referenceId?: string;   // ID of the related record
  description?: string;
  cryptoTransactionId?: string; // For crypto deposits
  cardId?: string;             // For card operations
  metadata?: Record<string, any>;
}

export const createUserBalanceUpdateWorker = () => {
  const worker = new Worker<UserBalanceUpdateJobData>(
    QUEUE_NAMES.USER_BALANCE_UPDATE,
    async (job: Job<UserBalanceUpdateJobData>) => {
      const { 
        userId, 
        amount, 
        type, 
        reason, 
        referenceType, 
        referenceId, 
        description,
        cryptoTransactionId
      } = job.data;
      
      logger.info('Processing user balance update', { 
        jobId: job.id,
        userId,
        amount,
        type,
        reason
      });

      try {
        // Validate user exists
        const user = await UserRepository.findById(userId);
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }

        // Get current balance
        const currentBalance = user.virtual_balance || 0;
        
        // Calculate new balance
        let newBalance: number;
        if (type === 'credit') {
          newBalance = currentBalance + amount;
        } else {
          newBalance = currentBalance - amount;
          
          // Prevent negative balance for certain operations
          if (newBalance < 0 && (reason === 'card_funding' || reason === 'withdrawal')) {
            throw new Error(`Insufficient balance: ${currentBalance} < ${amount}`);
          }
        }

        await job.updateProgress(30);

        // Map reason to transaction type
        const transactionTypeMap: Record<string, string> = {
          'crypto_deposit_completed': 'deposit',
          'card_funding': 'card_funding',
          'refund': 'refund',
          'fee': 'fee',
          'adjustment': 'adjustment',
          'withdrawal': 'withdrawal'
        };
        
        const transactionType = transactionTypeMap[reason] || 'deposit';

        try {
          // Update user balance
          await UserRepository.updateBalance(userId, newBalance);

          await job.updateProgress(60);

          // Create ledger entry
          await UserBalanceLedgerRepository.create({
            user_id: userId,
            transaction_type: transactionType as 'deposit' | 'card_funding' | 'refund' | 'withdrawal' | 'fee' | 'adjustment',
            amount: type === 'credit' ? amount : -amount,
            balance_before: currentBalance,
            balance_after: newBalance,
            reference_type: referenceType || reason,
            reference_id: referenceId || cryptoTransactionId || `job_${job.id}`,
            description: description || `${type === 'credit' ? 'Credit' : 'Debit'} - ${reason}`
          });

          await job.updateProgress(80);

          // Update related records
          if (cryptoTransactionId) {
            await CryptoTransactionRepository.markAsProcessed(cryptoTransactionId);
          }

          // All operations completed successfully

          await job.updateProgress(100);

          const result = {
            userId,
            previousBalance: currentBalance,
            newBalance,
            amountChanged: type === 'credit' ? amount : -amount,
            reason,
            timestamp: new Date().toISOString()
          };

          logger.info('User balance updated successfully', result);

          // Trigger notifications for significant changes
          if (amount >= 100) { // $100 or more
            const { queues } = await import('../../config/queue');
            await queues.emailNotifications.add('balance-update-notification', {
              userId,
              amount,
              type,
              reason,
              newBalance
            });
          }

          return result;

        } catch (error) {
          throw error;
        }

      } catch (error: any) {
        logger.error('User balance update failed', {
          error: error.message,
          jobId: job.id,
          userId,
          amount,
          type,
          reason
        });
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5, // Process multiple balance updates simultaneously
      limiter: {
        max: 100,     // Maximum 100 balance updates
        duration: 60000 // per minute
      }
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('User balance update job completed', {
      jobId: job.id,
      userId: job.data.userId,
      result
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('User balance update job failed', {
      jobId: job?.id,
      userId: job?.data?.userId,
      error: error.message,
      jobData: job?.data
    });
  });

  return worker;
};