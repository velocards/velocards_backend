import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { createRedisConnection } from '../../config/redis';
import { CryptoTransactionRepository } from '../../repositories/cryptoTransactionRepository';
import { getXMoneyClient } from '../../integrations/xmoney/client';
import logger from '../../utils/logger';

export interface CryptoOrderSyncJobData {
  orderId?: string; // Specific order to sync
  userId?: string;  // Sync all orders for a user
  fullSync?: boolean; // Sync all pending orders
  maxAge?: number;  // Only sync orders newer than X hours
}

export const createCryptoOrderSyncWorker = () => {
  const worker = new Worker<CryptoOrderSyncJobData>(
    QUEUE_NAMES.CRYPTO_ORDER_SYNC,
    async (job: Job<CryptoOrderSyncJobData>) => {
      const { orderId, userId, fullSync, maxAge = 24 } = job.data;
      
      logger.info('Starting crypto order sync', { 
        jobId: job.id, 
        orderId, 
        userId, 
        fullSync 
      });

      try {
        const xmoneyClient = getXMoneyClient();
        let ordersToSync: any[] = [];
        let syncedCount = 0;
        let updatedCount = 0;

        if (orderId) {
          // Sync specific order
          const order = await CryptoTransactionRepository.findByXMoneyId(orderId);
          if (order) {
            ordersToSync = [order];
          } else {
            logger.warn('Order not found in database', { orderId });
            return { error: 'Order not found', orderId };
          }
        } else if (userId) {
          // Sync all pending orders for a user
          const orders = await CryptoTransactionRepository.findPendingByUser(userId);
          ordersToSync = orders;
        } else if (fullSync) {
          // Sync all pending orders (limited by age)
          const cutoffTime = new Date();
          cutoffTime.setHours(cutoffTime.getHours() - maxAge);
          
          const orders = await CryptoTransactionRepository.findPendingAfter(cutoffTime);
          ordersToSync = orders;
        }

        logger.info(`Found ${ordersToSync.length} orders to sync`);

        // Process each order
        for (const localOrder of ordersToSync) {
          try {
            await job.updateProgress((syncedCount / ordersToSync.length) * 100);

            // Get latest status from xMoney
            const xmoneyOrder = await xmoneyClient.getOrder(localOrder.xmoney_payment_id);
            
            // Check if status changed
            const orderStatus = xmoneyOrder.data.attributes.status === 'paid' ? 'completed' : 'pending';
            const orderAmount = parseFloat(xmoneyOrder.data.attributes.total_amount.value);
            
            const needsUpdate = 
              localOrder.status !== orderStatus ||
              localOrder.fiat_amount !== orderAmount;

            if (needsUpdate) {
              // Update crypto transaction
              await CryptoTransactionRepository.updateFromXMoney(localOrder.id, {
                status: orderStatus,
                fiat_amount: orderAmount,
                synced_at: new Date()
              });

              // If order is now completed, trigger balance update
              if (orderStatus === 'completed' && localOrder.status !== 'completed') {
                // Add job to update user balance
                const { queues } = await import('../../config/queue');
                await queues.userBalanceUpdate.add('crypto-deposit-completed', {
                  userId: localOrder.user_id,
                  cryptoTransactionId: localOrder.id,
                  amount: orderAmount,
                  reason: 'crypto_deposit_completed'
                });

                logger.info('Triggered balance update for completed order', {
                  orderId: localOrder.xmoney_payment_id,
                  userId: localOrder.user_id,
                  amount: orderAmount
                });
              }

              // Log status change for debugging
              logger.info('Order status synchronized', {
                orderId: localOrder.xmoney_payment_id,
                userId: localOrder.user_id,
                oldStatus: localOrder.status,
                newStatus: orderStatus,
                amount: orderAmount
              });

              updatedCount++;
            }

            syncedCount++;

          } catch (orderError: any) {
            logger.error('Failed to sync individual order', {
              orderId: localOrder.xmoney_payment_id,
              error: orderError.message
            });
            // Continue with other orders
          }
        }

        const result = {
          totalOrders: ordersToSync.length,
          syncedOrders: syncedCount,
          updatedOrders: updatedCount,
          timestamp: new Date().toISOString()
        };

        logger.info('Crypto order sync completed', result);
        return result;

      } catch (error: any) {
        logger.error('Crypto order sync failed', {
          error: error.message,
          jobId: job.id,
          jobData: job.data
        });
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 2, // Process 2 sync jobs simultaneously
      limiter: {
        max: 10,      // Maximum 10 jobs
        duration: 60000 // per minute
      }
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('Crypto order sync job completed', {
      jobId: job.id,
      result
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Crypto order sync job failed', {
      jobId: job?.id,
      error: error.message,
      jobData: job?.data
    });
  });

  return worker;
};