import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../../config/queue';
import { createRedisConnection } from '../../config/redis';
import { CryptoTransactionRepository } from '../../repositories/cryptoTransactionRepository';
import { CryptoRepository } from '../../repositories/cryptoRepository';
import logger from '../../utils/logger';

export interface CryptoOrderCheckJobData {
  checkStuckOrders?: boolean;    // Check orders stuck in pending state
  cleanupExpiredOrders?: boolean; // Clean up orders older than X days
  maxPendingHours?: number;      // Orders pending longer than this are "stuck"
  maxOrderAgeDays?: number;      // Orders older than this are expired
}

export const createCryptoOrderCheckWorker = () => {
  const worker = new Worker<CryptoOrderCheckJobData>(
    QUEUE_NAMES.CRYPTO_ORDER_CHECK,
    async (job: Job<CryptoOrderCheckJobData>) => {
      const { 
        checkStuckOrders = true, 
        cleanupExpiredOrders = true,
        maxPendingHours = 2,
        maxOrderAgeDays = 7
      } = job.data;
      
      logger.info('Starting crypto order check', { 
        jobId: job.id,
        checkStuckOrders,
        cleanupExpiredOrders,
        maxPendingHours,
        maxOrderAgeDays
      });

      try {
        const results = {
          stuckOrders: 0,
          expiredOrders: 0,
          expiredXMoneyOrders: 0,
          retriedOrders: 0,
          notifiedUsers: 0,
          errors: 0
        };

        // Check for stuck orders (pending too long)
        if (checkStuckOrders) {
          const stuckCutoff = new Date();
          stuckCutoff.setHours(stuckCutoff.getHours() - maxPendingHours);
          
          const stuckOrders = await CryptoTransactionRepository.findStuckOrders(stuckCutoff);
          results.stuckOrders = stuckOrders.length;
          
          logger.info(`Found ${stuckOrders.length} stuck orders`);

          for (const order of stuckOrders) {
            try {
              // Trigger immediate sync for stuck orders
              const { queues } = await import('../../config/queue');
              await queues.cryptoOrderSync.add('sync-stuck-order', {
                orderId: order.xmoney_payment_id
              }, {
                priority: 10, // High priority
                delay: 0      // Immediate
              });

              results.retriedOrders++;

            } catch (error: any) {
              logger.error('Failed to retry stuck order', {
                orderId: order.xmoney_payment_id,
                error: error.message
              });
              results.errors++;
            }
          }
        }

        // Clean up expired orders
        if (cleanupExpiredOrders) {
          const expiredCutoff = new Date();
          expiredCutoff.setDate(expiredCutoff.getDate() - maxOrderAgeDays);
          
          const expiredOrders = await CryptoTransactionRepository.findExpiredOrders(expiredCutoff);
          results.expiredOrders = expiredOrders.length;
          
          logger.info(`Found ${expiredOrders.length} expired orders`);

          for (const order of expiredOrders) {
            try {
              // Mark as expired if still pending
              if (order.status === 'pending' || order.status === 'confirming') {
                await CryptoTransactionRepository.markAsExpired(order.id);

                // Notify user about expired order
                const { queues } = await import('../../config/queue');
                await queues.emailNotifications.add('crypto-order-expired', {
                  userId: order.user_id,
                  orderId: order.xmoney_payment_id,
                  amount: order.fiat_amount,
                  currency: order.crypto_currency,
                  createdAt: order.created_at
                });

                results.notifiedUsers++;
              }

            } catch (error: any) {
              logger.error('Failed to process expired order', {
                orderId: order.xmoney_payment_id,
                error: error.message
              });
              results.errors++;
            }
          }
        }

        // Also check for expired orders in xmoney_orders table
        if (cleanupExpiredOrders) {
          const expiredCutoff = new Date();
          expiredCutoff.setDate(expiredCutoff.getDate() - maxOrderAgeDays);
          
          const expiredXMoneyOrders = await CryptoRepository.findExpiredXMoneyOrders(expiredCutoff);
          results.expiredXMoneyOrders = expiredXMoneyOrders.length;
          
          logger.info(`Found ${expiredXMoneyOrders.length} expired xmoney orders`);

          for (const order of expiredXMoneyOrders) {
            try {
              // Mark as expired
              await CryptoRepository.markOrderAsExpired(order.id);

              // Log the expiration
              logger.info('Marked xmoney order as expired', {
                orderId: order.id,
                orderReference: order.order_reference,
                userId: order.user_id,
                amount: order.amount,
                createdAt: order.created_at,
                daysOld: Math.floor((Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24))
              });

              // Notify user about expired order (optional)
              const { queues } = await import('../../config/queue');
              await queues.emailNotifications.add('deposit-order-expired', {
                userId: order.user_id,
                orderReference: order.order_reference,
                amount: order.amount,
                currency: order.currency,
                createdAt: order.created_at
              });

              results.notifiedUsers++;

            } catch (error: any) {
              logger.error('Failed to process expired xmoney order', {
                orderId: order.id,
                orderReference: order.order_reference,
                error: error.message
              });
              results.errors++;
            }
          }
        }

        // Additional health checks
        await job.updateProgress(50);

        // Check for orders with inconsistent states
        const inconsistentOrders = await CryptoTransactionRepository.findInconsistentStates();
        if (inconsistentOrders.length > 0) {
          logger.warn(`Found ${inconsistentOrders.length} orders with inconsistent states`);
          
          // Trigger sync for inconsistent orders
          for (const order of inconsistentOrders) {
            const { queues } = await import('../../config/queue');
            await queues.cryptoOrderSync.add('sync-inconsistent-order', {
              orderId: order.xmoney_payment_id
            });
          }
        }

        await job.updateProgress(100);

        logger.info('Crypto order check completed', results);
        return results;

      } catch (error: any) {
        logger.error('Crypto order check failed', {
          error: error.message,
          jobId: job.id
        });
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 1, // Only one check job at a time
      limiter: {
        max: 5,       // Maximum 5 check jobs
        duration: 300000 // per 5 minutes
      }
    }
  );

  worker.on('completed', (job, result) => {
    logger.info('Crypto order check job completed', {
      jobId: job.id,
      result
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Crypto order check job failed', {
      jobId: job?.id,
      error: error.message
    });
  });

  return worker;
};