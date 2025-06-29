"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCardSyncWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const cardRepository_1 = require("../../repositories/cardRepository");
const admediacards_1 = require("../../integrations/admediacards");
const logger_1 = __importDefault(require("../../utils/logger"));
const redis_1 = require("../../config/redis");
/**
 * Process card sync jobs
 * Updates card details from Admediacards API
 */
const createCardSyncWorker = () => {
    const connection = (0, redis_1.createRedisConnection)();
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.CARD_SYNC, async (job) => {
        const { userId, cardId, fullSync } = job.data;
        logger_1.default.info('Starting card sync job', {
            jobId: job.id,
            userId,
            cardId,
            fullSync
        });
        try {
            await job.updateProgress(10);
            const admediacardsClient = (0, admediacards_1.getAdmediacardsClient)();
            let cardsToSync = [];
            // Determine which cards to sync
            if (cardId) {
                const card = await cardRepository_1.CardRepository.findById(cardId);
                if (card && card.admediacards_card_id) {
                    cardsToSync = [{ id: card.id, admediacards_card_id: card.admediacards_card_id }];
                }
            }
            else if (userId) {
                const userCards = await cardRepository_1.CardRepository.findByUserId(userId);
                cardsToSync = userCards
                    .filter(card => card.admediacards_card_id)
                    .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
            }
            else if (fullSync) {
                const allCards = await cardRepository_1.CardRepository.findAllActive();
                cardsToSync = allCards
                    .filter(card => card.admediacards_card_id)
                    .map(card => ({ id: card.id, admediacards_card_id: card.admediacards_card_id }));
            }
            logger_1.default.info(`Found ${cardsToSync.length} cards to sync`);
            await job.updateProgress(20);
            let synced = 0;
            let errors = 0;
            const updates = [];
            // Process each card
            for (let i = 0; i < cardsToSync.length; i++) {
                const card = cardsToSync[i];
                if (!card)
                    continue;
                const progress = 20 + (i / cardsToSync.length) * 70;
                await job.updateProgress(progress);
                try {
                    // Get latest card details from Admediacards
                    const cardDetails = await admediacardsClient.getCard(parseInt(card.admediacards_card_id));
                    // Check for status changes
                    const currentCard = await cardRepository_1.CardRepository.findById(card.id);
                    const status = cardDetails.IsActive ? 'active' : 'frozen';
                    const statusChanged = currentCard?.status !== status;
                    // Update card in our database
                    await cardRepository_1.CardRepository.updateFromAdmediacards(card.id, {
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
                }
                catch (cardError) {
                    logger_1.default.error('Failed to sync card', {
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
            logger_1.default.info('Card sync job completed', {
                jobId: job.id,
                ...result
            });
            return result;
        }
        catch (error) {
            logger_1.default.error('Card sync job failed', {
                jobId: job.id,
                error
            });
            throw error;
        }
    }, {
        connection,
        concurrency: 3, // Process 3 jobs concurrently
        limiter: {
            max: 15,
            duration: 60000 // Max 15 jobs per minute
        }
    });
    worker.on('completed', (job) => {
        logger_1.default.info(`Card sync job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Card sync job ${job?.id} failed:`, err);
    });
    return worker;
};
exports.createCardSyncWorker = createCardSyncWorker;
//# sourceMappingURL=cardSyncProcessor.js.map