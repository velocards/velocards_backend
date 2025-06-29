import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { TransactionRepository } from '../../repositories/transactionRepository';
import { CardRepository } from '../../repositories/cardRepository';
import { getAdmediacardsClient } from '../../integrations/admediacards';
import logger from '../../utils/logger';
import { createRedisConnection } from '../../config/redis';

export interface TransactionSyncJobData {
  userId?: string;
  cardId?: string;
  startDate?: string;
  endDate?: string;
  fullSync?: boolean;
}

/**
 * Process transaction sync jobs
 * Syncs transactions from Admediacards to our database
 */
export const createTransactionSyncWorker = () => {
  const connection = createRedisConnection();
  
  const worker = new Worker<TransactionSyncJobData>(
    QUEUE_NAMES.TRANSACTION_SYNC,
    async (job: Job<TransactionSyncJobData>) => {
      const { userId, cardId, startDate, endDate, fullSync } = job.data;
      
      logger.info('Starting transaction sync job', {
        jobId: job.id,
        userId,
        cardId,
        startDate,
        endDate,
        fullSync
      });
      
      try {
        // Update job progress
        await job.updateProgress(10);
        
        const admediacardsClient = getAdmediacardsClient();
        let cardsToSync: Array<{ id: string; admediacards_card_id: string }> = [];
        
        // Determine which cards to sync
        if (cardId) {
          // Sync specific card
          const card = await CardRepository.findById(cardId);
          if (card && card.admediacards_card_id) {
            cardsToSync = [{ id: card.id, admediacards_card_id: card.admediacards_card_id }];
          }
        } else if (userId) {
          // Sync all cards for a user
          const userCards = await CardRepository.findByUserId(userId);
          cardsToSync = userCards
            .filter(card => card.admediacards_card_id)
            .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
        } else if (fullSync) {
          // Sync all active cards in the system
          const allCards = await CardRepository.findAllActive();
          cardsToSync = allCards
            .filter(card => card.admediacards_card_id)
            .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
        }
        
        logger.info(`Found ${cardsToSync.length} cards to sync`);
        await job.updateProgress(20);
        
        let totalSynced = 0;
        let errors = 0;
        
        // Process each card
        for (let i = 0; i < cardsToSync.length; i++) {
          const card = cardsToSync[i];
          if (!card) continue;
          
          const progress = 20 + (i / cardsToSync.length) * 70;
          await job.updateProgress(progress);
          
          try {
            // Get transactions from Admediacards
            const transactionsResponse = await admediacardsClient.getCardTransactions(
              parseInt(card.admediacards_card_id)
            );
            
            // Sync each transaction to our database
            const transactions = transactionsResponse.Result || [];
            for (const tx of transactions) {
              try {
                await TransactionRepository.syncFromAdmediacards(card.id, tx);
                totalSynced++;
              } catch (txError) {
                logger.error('Failed to sync transaction', {
                  cardId: card.id,
                  transactionId: tx.TransactionID,
                  error: txError
                });
                errors++;
              }
            }
            
            // Update card's last sync timestamp
            await CardRepository.updateLastSyncedAt(card.id);
            
          } catch (cardError) {
            logger.error('Failed to sync transactions for card', {
              cardId: card?.id,
              error: cardError
            });
            errors++;
          }
        }
        
        await job.updateProgress(100);
        
        const result = {
          totalCards: cardsToSync.length,
          totalTransactions: totalSynced,
          errors,
          completedAt: new Date().toISOString()
        };
        
        logger.info('Transaction sync job completed', {
          jobId: job.id,
          ...result
        });
        
        return result;
        
      } catch (error) {
        logger.error('Transaction sync job failed', {
          jobId: job.id,
          error
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // Process 2 jobs concurrently
      limiter: {
        max: 10,
        duration: 60000 // Max 10 jobs per minute to avoid rate limits
      }
    }
  );
  
  worker.on('completed', (job) => {
    logger.info(`Transaction sync job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Transaction sync job ${job?.id} failed:`, err);
  });
  
  return worker;
};