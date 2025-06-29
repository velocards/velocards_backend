import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { CryptoService } from '../../services/cryptoService';
import { supabase } from '../../config/database';
import logger from '../../utils/logger';
import { createRedisConnection } from '../../config/redis';

export interface WebhookJobData {
  provider: 'admediacards' | 'xmoney';
  event_id: string;
  event_type: string;
  payload: any;
  signature?: string;
  received_at: string;
}

/**
 * Process webhook events asynchronously
 */
export const createWebhookWorker = () => {
  const connection = createRedisConnection();
  
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK_PROCESSING,
    async (job: Job<WebhookJobData>) => {
      const { provider, event_id, event_type, payload, signature } = job.data;
      
      logger.info('Processing webhook job', {
        jobId: job.id,
        provider,
        eventId: event_id,
        eventType: event_type
      });
      
      try {
        // Check if webhook was already processed
        const { data: existingWebhook } = await supabase
          .from('webhook_events')
          .select('id, processed')
          .eq('event_id', event_id)
          .single();
          
        if (existingWebhook?.processed) {
          logger.info('Webhook already processed, skipping', { eventId: event_id });
          return { status: 'already_processed', eventId: event_id };
        }
        
        // Create or update webhook record
        const { error: webhookError } = await supabase
          .from('webhook_events')
          .upsert({
            provider,
            event_type,
            event_id,
            payload,
            signature,
            processed: false,
            created_at: job.data.received_at
          });
          
        if (webhookError) throw webhookError;
        
        let result: any;
        
        // Process based on provider
        switch (provider) {
          case 'xmoney':
            result = await processXMoneyWebhook(event_type, payload, signature || '');
            break;
            
          case 'admediacards':
            result = await processAdmediacardsWebhook(event_type, payload);
            break;
            
          default:
            throw new Error(`Unknown webhook provider: ${provider}`);
        }
        
        // Mark webhook as processed
        await supabase
          .from('webhook_events')
          .update({
            processed: true,
            processed_at: new Date(),
            metadata: { result }
          })
          .eq('event_id', event_id);
          
        logger.info('Webhook processed successfully', {
          jobId: job.id,
          eventId: event_id,
          result
        });
        
        return {
          status: 'processed',
          eventId: event_id,
          result
        };
        
      } catch (error) {
        logger.error('Webhook processing failed', {
          jobId: job.id,
          eventId: event_id,
          error
        });
        
        // Update webhook with error
        await supabase
          .from('webhook_events')
          .update({
            error_message: (error as Error).message,
            retry_count: job.attemptsMade
          })
          .eq('event_id', event_id);
          
        throw error;
      }
    },
    {
      connection,
      concurrency: 5 // Process 5 webhooks concurrently
    }
  );
  
  worker.on('completed', (job) => {
    logger.info(`Webhook job ${job.id} completed`);
  });
  
  worker.on('failed', (job, err) => {
    logger.error(`Webhook job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err);
  });
  
  return worker;
};

/**
 * Process xMoney webhooks
 */
async function processXMoneyWebhook(
  eventType: string,
  payload: any,
  signature: string
): Promise<any> {
  // Use the crypto service to process xMoney webhooks
  await CryptoService.processWebhook(payload, signature);
  
  return {
    provider: 'xmoney',
    eventType,
    processedAt: new Date().toISOString()
  };
}

/**
 * Process Admediacards webhooks
 */
async function processAdmediacardsWebhook(
  eventType: string,
  payload: any
): Promise<any> {
  // Handle different Admediacards webhook events
  switch (eventType) {
    case 'card.created':
    case 'card.updated':
    case 'card.deleted':
      // Queue a card sync job
      const { queues } = await import('../../config/queue');
      await queues.cardSync.add('webhook-triggered', {
        cardId: payload.card_id,
        fullSync: false
      });
      break;
      
    case 'transaction.authorized':
    case 'transaction.settled':
    case 'transaction.declined':
    case 'transaction.reversed':
      // Queue a transaction sync job
      const { queues: txQueues } = await import('../../config/queue');
      await txQueues.transactionSync.add('webhook-triggered', {
        cardId: payload.card_id,
        fullSync: false
      });
      break;
      
    default:
      logger.warn('Unknown Admediacards webhook event type', { eventType });
  }
  
  return {
    provider: 'admediacards',
    eventType,
    processedAt: new Date().toISOString()
  };
}