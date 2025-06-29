"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransactionSyncWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const transactionRepository_1 = require("../../repositories/transactionRepository");
const cardRepository_1 = require("../../repositories/cardRepository");
const admediacards_1 = require("../../integrations/admediacards");
const logger_1 = __importDefault(require("../../utils/logger"));
const redis_1 = require("../../config/redis");
/**
 * Process transaction sync jobs
 * Syncs transactions from Admediacards to our database
 */
const createTransactionSyncWorker = () => {
    const connection = (0, redis_1.createRedisConnection)();
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.TRANSACTION_SYNC, async (job) => {
        const { userId, cardId, startDate, endDate, fullSync } = job.data;
        logger_1.default.info('Starting transaction sync job', {
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
            const admediacardsClient = (0, admediacards_1.getAdmediacardsClient)();
            let cardsToSync = [];
            // Determine which cards to sync
            if (cardId) {
                // Sync specific card
                const card = await cardRepository_1.CardRepository.findById(cardId);
                if (card && card.admediacards_card_id) {
                    cardsToSync = [{ id: card.id, admediacards_card_id: card.admediacards_card_id }];
                }
            }
            else if (userId) {
                // Sync all cards for a user
                const userCards = await cardRepository_1.CardRepository.findByUserId(userId);
                cardsToSync = userCards
                    .filter(card => card.admediacards_card_id)
                    .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
            }
            else if (fullSync) {
                // Sync all active cards in the system
                const allCards = await cardRepository_1.CardRepository.findAllActive();
                cardsToSync = allCards
                    .filter(card => card.admediacards_card_id)
                    .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
            }
            logger_1.default.info(`Found ${cardsToSync.length} cards to sync`);
            await job.updateProgress(20);
            let totalSynced = 0;
            let errors = 0;
            // Process each card
            for (let i = 0; i < cardsToSync.length; i++) {
                const card = cardsToSync[i];
                if (!card)
                    continue;
                const progress = 20 + (i / cardsToSync.length) * 70;
                await job.updateProgress(progress);
                try {
                    // Get transactions from Admediacards
                    const transactionsResponse = await admediacardsClient.getCardTransactions(parseInt(card.admediacards_card_id));
                    // Sync each transaction to our database
                    const transactions = transactionsResponse.Result || [];
                    for (const tx of transactions) {
                        try {
                            await transactionRepository_1.TransactionRepository.syncFromAdmediacards(card.id, tx);
                            totalSynced++;
                        }
                        catch (txError) {
                            logger_1.default.error('Failed to sync transaction', {
                                cardId: card.id,
                                transactionId: tx.TransactionID,
                                error: txError
                            });
                            errors++;
                        }
                    }
                    // Update card's last sync timestamp
                    await cardRepository_1.CardRepository.updateLastSyncedAt(card.id);
                }
                catch (cardError) {
                    logger_1.default.error('Failed to sync transactions for card', {
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
            logger_1.default.info('Transaction sync job completed', {
                jobId: job.id,
                ...result
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Transaction sync job failed', {
                jobId: job.id,
                error
            });
            throw error;
        }
    }, {
        connection,
        concurrency: 2, // Process 2 jobs concurrently
        limiter: {
            max: 10,
            duration: 60000 // Max 10 jobs per minute to avoid rate limits
        }
    });
    worker.on('completed', (job) => {
        logger_1.default.info(`Transaction sync job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Transaction sync job ${job?.id} failed:`, err);
    });
    return worker;
};
exports.createTransactionSyncWorker = createTransactionSyncWorker;
//# sourceMappingURL=transactionSyncProcessor.js.map