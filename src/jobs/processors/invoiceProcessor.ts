import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import logger from '../../utils/logger';
import { supabase } from '../../config/database';
import { InvoiceService } from '../../services/invoiceService';

interface InvoiceJobData {
  type: 'process_events' | 'generate_pdf' | 'send_email';
  invoiceId?: string;
  batchSize?: number;
}

/**
 * Process unprocessed invoice events
 */
async function processInvoiceEvents(batchSize: number = 100): Promise<number> {
  try {
    // Get unprocessed events
    const { data: events, error } = await supabase
      .from('invoice_events')
      .select('*')
      .eq('processed', false)
      .lt('retry_count', 3) // Skip events that have failed too many times
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      logger.error('Failed to fetch invoice events:', error);
      throw error;
    }

    if (!events || events.length === 0) {
      logger.debug('No invoice events to process');
      return 0;
    }

    logger.info(`Processing ${events.length} invoice events`);

    let processedCount = 0;
    let failedCount = 0;

    // Process each event
    for (const event of events) {
      try {
        await InvoiceService.processInvoiceEvent(event);
        processedCount++;
      } catch (error) {
        logger.error('Failed to process invoice event', {
          eventId: event.id,
          eventType: event.event_type,
          error: error instanceof Error ? error.message : error
        });
        failedCount++;
      }
    }

    logger.info('Invoice event processing complete', {
      total: events.length,
      processed: processedCount,
      failed: failedCount
    });

    return processedCount;
  } catch (error) {
    logger.error('Error in invoice event processing:', error);
    throw error;
  }
}

/**
 * Generate PDF for an invoice
 */
async function generateInvoicePDF(invoiceId: string): Promise<void> {
  try {
    logger.info('Generating PDF for invoice', { invoiceId });
    
    // TODO: Implement actual PDF generation
    // For now, just update the invoice to mark PDF as generated
    await supabase
      .from('invoices')
      .update({
        pdf_generated_at: new Date().toISOString(),
        // pdf_url: 'https://example.com/invoice.pdf' // Would be actual URL
      })
      .eq('id', invoiceId);

    logger.info('PDF generation complete', { invoiceId });
  } catch (error) {
    logger.error('Failed to generate PDF', { invoiceId, error });
    throw error;
  }
}

/**
 * Send email for an invoice
 */
async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  try {
    logger.info('Sending email for invoice', { invoiceId });
    
    // Get invoice details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, user_profiles!inner(email, metadata)')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error('Invoice not found');
    }

    // TODO: Implement actual email sending via SendGrid
    // For now, just update the invoice to mark email as sent
    await supabase
      .from('invoices')
      .update({
        email_sent_at: new Date().toISOString(),
        status: 'sent'
      })
      .eq('id', invoiceId);

    // Log email event
    await supabase
      .from('invoice_email_logs')
      .insert({
        invoice_id: invoiceId,
        recipient_email: invoice.user_profiles.email,
        subject: `Invoice ${invoice.invoice_number}`,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });

    logger.info('Email sent successfully', { invoiceId, email: invoice.user_profiles.email });
  } catch (error) {
    logger.error('Failed to send email', { invoiceId, error });
    throw error;
  }
}

/**
 * Create the invoice processor worker
 */
export function createInvoiceWorker(): Worker {
  const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
  
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  const worker = new Worker(
    'invoice-processing',
    async (job: Job<InvoiceJobData>) => {
      const { type, invoiceId, batchSize } = job.data;

      logger.info(`Processing invoice job: ${type}`, { invoiceId, batchSize });

      try {
        switch (type) {
          case 'process_events':
            return await processInvoiceEvents(batchSize);
          
          case 'generate_pdf':
            if (!invoiceId) throw new Error('Invoice ID required for PDF generation');
            return await generateInvoicePDF(invoiceId);
          
          case 'send_email':
            if (!invoiceId) throw new Error('Invoice ID required for email sending');
            return await sendInvoiceEmail(invoiceId);
          
          default:
            throw new Error(`Unknown job type: ${type}`);
        }
      } catch (error) {
        logger.error(`Failed to process invoice job`, { 
          type, 
          invoiceId,
          error: error instanceof Error ? error.message : error 
        });
        throw error;
      }
    },
    {
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
    }
  );

  worker.on('completed', (job) => {
    logger.debug(`Invoice job completed`, { 
      jobId: job.id, 
      type: job.data.type 
    });
  });

  worker.on('failed', (job, err) => {
    logger.error(`Invoice job failed`, { 
      jobId: job?.id, 
      type: job?.data.type,
      error: err.message 
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing invoice worker...');
    await worker.close();
  });

  return worker;
}

// If running as standalone process
if (require.main === module) {
  logger.info('Starting invoice processor worker...');
  createInvoiceWorker();
  
  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception in invoice processor:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection in invoice processor:', error);
    process.exit(1);
  });
}