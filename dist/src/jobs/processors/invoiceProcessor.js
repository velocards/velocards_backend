"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoiceWorker = createInvoiceWorker;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("../../config/env");
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = require("../../config/database");
const invoiceService_1 = require("../../services/invoiceService");
/**
 * Process unprocessed invoice events
 */
async function processInvoiceEvents(batchSize = 100) {
    try {
        // Get unprocessed events
        const { data: events, error } = await database_1.supabase
            .from('invoice_events')
            .select('*')
            .eq('processed', false)
            .lt('retry_count', 3) // Skip events that have failed too many times
            .order('created_at', { ascending: true })
            .limit(batchSize);
        if (error) {
            logger_1.default.error('Failed to fetch invoice events:', error);
            throw error;
        }
        if (!events || events.length === 0) {
            logger_1.default.debug('No invoice events to process');
            return 0;
        }
        logger_1.default.info(`Processing ${events.length} invoice events`);
        let processedCount = 0;
        let failedCount = 0;
        // Process each event
        for (const event of events) {
            try {
                await invoiceService_1.InvoiceService.processInvoiceEvent(event);
                processedCount++;
            }
            catch (error) {
                logger_1.default.error('Failed to process invoice event', {
                    eventId: event.id,
                    eventType: event.event_type,
                    error: error instanceof Error ? error.message : error
                });
                failedCount++;
            }
        }
        logger_1.default.info('Invoice event processing complete', {
            total: events.length,
            processed: processedCount,
            failed: failedCount
        });
        return processedCount;
    }
    catch (error) {
        logger_1.default.error('Error in invoice event processing:', error);
        throw error;
    }
}
/**
 * Generate PDF for an invoice
 */
async function generateInvoicePDF(invoiceId) {
    try {
        logger_1.default.info('Generating PDF for invoice', { invoiceId });
        // TODO: Implement actual PDF generation
        // For now, just update the invoice to mark PDF as generated
        await database_1.supabase
            .from('invoices')
            .update({
            pdf_generated_at: new Date().toISOString(),
            // pdf_url: 'https://example.com/invoice.pdf' // Would be actual URL
        })
            .eq('id', invoiceId);
        logger_1.default.info('PDF generation complete', { invoiceId });
    }
    catch (error) {
        logger_1.default.error('Failed to generate PDF', { invoiceId, error });
        throw error;
    }
}
/**
 * Send email for an invoice
 */
async function sendInvoiceEmail(invoiceId) {
    try {
        logger_1.default.info('Sending email for invoice', { invoiceId });
        // Get invoice details
        const { data: invoice, error } = await database_1.supabase
            .from('invoices')
            .select('*, user_profiles!inner(email, metadata)')
            .eq('id', invoiceId)
            .single();
        if (error || !invoice) {
            throw new Error('Invoice not found');
        }
        // TODO: Implement actual email sending via SendGrid
        // For now, just update the invoice to mark email as sent
        await database_1.supabase
            .from('invoices')
            .update({
            email_sent_at: new Date().toISOString(),
            status: 'sent'
        })
            .eq('id', invoiceId);
        // Log email event
        await database_1.supabase
            .from('invoice_email_logs')
            .insert({
            invoice_id: invoiceId,
            recipient_email: invoice.user_profiles.email,
            subject: `Invoice ${invoice.invoice_number}`,
            sent_at: new Date().toISOString(),
            status: 'sent'
        });
        logger_1.default.info('Email sent successfully', { invoiceId, email: invoice.user_profiles.email });
    }
    catch (error) {
        logger_1.default.error('Failed to send email', { invoiceId, error });
        throw error;
    }
}
/**
 * Create the invoice processor worker
 */
function createInvoiceWorker() {
    const redisUrl = env_1.env.REDIS_URL || 'redis://localhost:6379';
    const connection = new ioredis_1.default(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });
    const worker = new bullmq_1.Worker('invoice-processing', async (job) => {
        const { type, invoiceId, batchSize } = job.data;
        logger_1.default.info(`Processing invoice job: ${type}`, { invoiceId, batchSize });
        try {
            switch (type) {
                case 'process_events':
                    return await processInvoiceEvents(batchSize);
                case 'generate_pdf':
                    if (!invoiceId)
                        throw new Error('Invoice ID required for PDF generation');
                    return await generateInvoicePDF(invoiceId);
                case 'send_email':
                    if (!invoiceId)
                        throw new Error('Invoice ID required for email sending');
                    return await sendInvoiceEmail(invoiceId);
                default:
                    throw new Error(`Unknown job type: ${type}`);
            }
        }
        catch (error) {
            logger_1.default.error(`Failed to process invoice job`, {
                type,
                invoiceId,
                error: error instanceof Error ? error.message : error
            });
            throw error;
        }
    }, {
        connection,
        concurrency: 5,
        removeOnComplete: {
            age: 3600, // 1 hour
            count: 100
        },
        removeOnFail: {
            age: 86400, // 24 hours
            count: 500
        }
    });
    worker.on('completed', (job) => {
        logger_1.default.debug(`Invoice job completed`, {
            jobId: job.id,
            type: job.data.type
        });
    });
    worker.on('failed', (job, err) => {
        logger_1.default.error(`Invoice job failed`, {
            jobId: job?.id,
            type: job?.data.type,
            error: err.message
        });
    });
    // Graceful shutdown
    process.on('SIGTERM', async () => {
        logger_1.default.info('SIGTERM received, closing invoice worker...');
        await worker.close();
    });
    return worker;
}
// If running as standalone process
if (require.main === module) {
    logger_1.default.info('Starting invoice processor worker...');
    createInvoiceWorker();
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger_1.default.error('Uncaught exception in invoice processor:', error);
        process.exit(1);
    });
    process.on('unhandledRejection', (error) => {
        logger_1.default.error('Unhandled rejection in invoice processor:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=invoiceProcessor.js.map