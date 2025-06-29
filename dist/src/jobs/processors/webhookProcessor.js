"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhookWorker = void 0;
const bullmq_1 = require("bullmq");
const queue_1 = require("../../config/queue");
const cryptoService_1 = require("../../services/cryptoService");
const database_1 = require("../../config/database");
const logger_1 = __importDefault(require("../../utils/logger"));
const redis_1 = require("../../config/redis");
/**
 * Process webhook events asynchronously
 */
const createWebhookWorker = () => {
    const connection = (0, redis_1.createRedisConnection)();
    const worker = new bullmq_1.Worker(queue_1.QUEUE_NAMES.WEBHOOK_PROCESSING, async (job) => {
        const { provider, event_id, event_type, payload, signature } = job.data;
        logger_1.default.info('Processing webhook job', {
            jobId: job.id,
            provider,
            eventId: event_id,
            eventType: event_type
        });
        try {
            // Check if webhook was already processed
            const { data: existingWebhook } = await database_1.supabase
                .from('webhook_events')
                .select('id, processed')
                .eq('event_id', event_id)
                .single();
            if (existingWebhook?.processed) {
                logger_1.default.info('Webhook already processed, skipping', { eventId: event_id });
                return { status: 'already_processed', eventId: event_id };
            }
            // Create or update webhook record
            const { error: webhookError } = await database_1.supabase
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
            if (webhookError)
                throw webhookError;
            let result;
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
            await database_1.supabase
                .from('webhook_events')
                .update({
                processed: true,
                processed_at: new Date(),
                metadata: { result }
            })
                .eq('event_id', event_id);
            logger_1.default.info('Webhook processed successfully', {
                jobId: job.id,
                eventId: event_id,
                result
            });
            return {
                status: 'processed',
                eventId: event_id,
                result
            };
        }
        catch (error) {
            logger_1.default.error('Webhook processing failed', {
                jobId: job.id,
                eventId: event_id,
                error
            });
            // Update webhook with error
            await database_1.supabase
                .from('webhook_events')
                .update({
                error_message: error.message,
                retry_count: job.attemptsMade
            })
                .eq('event_id', event_id);
            throw error;
        }
    }, {
        connection,
        concurrency: 5 // Process 5 webhooks concurrently
    });
    worker.on('completed', (job) => {
        logger_1.default.info(`Webhook job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Webhook job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err);
    });
    return worker;
};
exports.createWebhookWorker = createWebhookWorker;
/**
 * Process xMoney webhooks
 */
async function processXMoneyWebhook(eventType, payload, signature) {
    // Use the crypto service to process xMoney webhooks
    await cryptoService_1.CryptoService.processWebhook(payload, signature);
    return {
        provider: 'xmoney',
        eventType,
        processedAt: new Date().toISOString()
    };
}
/**
 * Process Admediacards webhooks
 */
async function processAdmediacardsWebhook(eventType, payload) {
    // Handle different Admediacards webhook events
    switch (eventType) {
        case 'card.created':
        case 'card.updated':
        case 'card.deleted':
            // Queue a card sync job
            const { queues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
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
            const { queues: txQueues } = await Promise.resolve().then(() => __importStar(require('../../config/queue')));
            await txQueues.transactionSync.add('webhook-triggered', {
                cardId: payload.card_id,
                fullSync: false
            });
            break;
        default:
            logger_1.default.warn('Unknown Admediacards webhook event type', { eventType });
    }
    return {
        provider: 'admediacards',
        eventType,
        processedAt: new Date().toISOString()
    };
}
//# sourceMappingURL=webhookProcessor.js.map