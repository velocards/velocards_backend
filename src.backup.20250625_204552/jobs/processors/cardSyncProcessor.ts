import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { CardRepository } from '../../repositories/cardRepository';
import { getAdmediacardsClient } from '../../integrations/admediacards';
import logger from '../../utils/logger';
import { createRedisConnection } from '../../config/redis';

export interface CardSyncJobData {
  userId?: string;
  cardId?: string;
  fullSync?: boolean;
}

/**
 * Process card sync jobs
 * Updates card details from Admediacards API
 */
export const createCardSyncWorker = () => {
  const connection = createRedisConnection();
  
  const worker = new Worker<CardSyncJobData>(
    QUEUE_NAMES.CARD_SYNC,
    async (job: Job<CardSyncJobData>) => {
      const { userId, cardId, fullSync } = job.data;
      
      logger.info('Starting card sync job', {
        jobId: job.id,
        userId,
        cardId,
        fullSync
      });
      
      try {
        await job.updateProgress(10);
        
        const admediacardsClient = getAdmediacardsClient();
        let cardsToSync: Array<{ id: string; admediacards_card_id: string }> = [];
        
        // Determine which cards to sync
        if (cardId) {
          const card = await CardRepository.findById(cardId);
          if (card && card.admediacards_card_id) {
            cardsToSync = [{ id: card.id, admediacards_card_id: card.admediacards_card_id }];
          }
        } else if (userId) {
          const userCards = await CardRepository.findByUserId(userId);
          cardsToSync = userCards
            .filter(card => card.admediacards_card_id)
            .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
        } else if (fullSync) {
          const allCards = await CardRepository.findAllActive();
          cardsToSync = allCards
            .filter(card => card.admediacards_card_id)
            .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
        }
        
        logger.info(`Found ${cardsToSync.length} cards to sync`);
        await job.updateProgress(20);
        
        let synced = 0;
        let errors = 0;
        const updates: any[] = [];
        
        // Process each card
        for (let i = 0; i < cardsToSync.length; i++) {
          const card = cardsToSync[i];
          if (!card) continue;
          
          const progress = 20 + (i / cardsToSync.length) * 70;
          await job.updateProgress(progress);
          
          try {
            // Get latest card details from Admediacards
            const cardDetails = await admediacardsClient.getCard(
              parseInt(card.admediacards_card_id)
            );
            
            // Check for status changes
            const currentCard = await CardRepository.findById(card.id);
            const status = cardDetails.IsActive ? 'active' : 'frozen';
            const statusChanged = currentCard?.status !== status;
            
            // Update card in our database
            await CardRepository.updateFromAdmediacards(card.id, {
              status: status,
              remaining_balance: cardDetails.Balance,
              spent_amount: cardDetails.Spend || 0,
              last_synced_at: new Date(),
              metadata: {
                ...currentCard?.metadata,
                admediacards_last_response: cardDetails,
                last_status_change: statusChanged ? new Date().toISOString() : currentCard?.metadata?.['last_status_change']
              }
            });
            
            synced++;
            updates.push({
              cardId: card.id,
              status: cardDetails.IsActive ? 'active' : 'frozen',
              balance: cardDetails.Balance,
              statusChanged
            });
            
          } catch (cardError) {
            logger.error('Failed to sync card', {
              cardId: card?.id,
              error: cardError
            });
            errors++;
          }
        }
        
        await job.updateProgress(100);
        
        const result = {
          totalCards: cardsToSync.length,
          synced,
          errors,
          updates,
          completedAt: new Date().toISOString()
        };
        
        logger.info('Card sync job completed', {
          jobId: job.id,
          ...result
        });
        
        return result;
        
      } catch (error) {
        logger.error('Card sync job failed', {
          jobId: job.id,
          error
        });
        throw error;
      }
    },
    {
      connection,
      concurrency: 3, // Process 3 jobs concurrently
      limiter: {
        max: 15,
        duration: 60000 // Max 15 jobs per minute
      }
    }
  );
  
  worker.on('completed', (job) => {
    logger.info(`Card sync job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Card sync job ${job?.id} failed:`, err);
  });
  
  return worker;
};