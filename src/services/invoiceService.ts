import { supabase } from '../config/database';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

// Type definitions
type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'failed';
type InvoiceType = 'card_transaction' | 'crypto_deposit' | 'crypto_withdrawal' | 'monthly_fee' | 
                   'card_creation_fee' | 'deposit_fee' | 'manual' | 'consolidated';

interface InvoiceEvent {
  id: string;
  event_type: string;
  event_data: any;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  invoice_date: string;
  due_date?: string;
  paid_date?: string;
  reference_type?: string;
  reference_id?: string;
  pdf_url?: string;
  pdf_generated_at?: string;
  email_sent_at?: string;
  email_viewed_at?: string;
  notes?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate: number;
  tax_amount: number;
  reference_type?: string;
  reference_id?: string;
  metadata?: any;
  sort_order: number;
}

interface InvoiceSettings {
  company_name?: string;
  billing_address?: any;
  tax_id?: string;
  auto_generate_pdf: boolean;
  auto_send_email: boolean;
  include_zero_amount: boolean;
  group_daily_fees: boolean;
  email_subject_template?: string;
  email_body_template?: string;
  cc_emails?: string[];
  logo_url?: string;
  footer_text?: string;
  terms_and_conditions?: string;
  invoice_prefix: string;
  next_invoice_number: number;
}

export class InvoiceService {
  /**
   * Process a single invoice event
   */
  static async processInvoiceEvent(event: InvoiceEvent): Promise<void> {
    try {
      logger.info('Processing invoice event', {
        eventId: event.id,
        eventType: event.event_type,
        userId: event.event_data.userId
      });

      // CRITICAL: Only process events for successful/completed transactions
      if (!this.isSuccessfulTransaction(event)) {
        logger.debug('Skipping invoice for non-successful transaction', { 
          eventId: event.id,
          eventType: event.event_type,
          status: event.event_data.status
        });
        await this.markEventProcessed(event.id);
        return;
      }

      // Determine invoice type based on event type
      const invoiceType = this.mapEventTypeToInvoiceType(event.event_type);
      
      // Get user settings (or global settings)
      const settings = await this.getUserInvoiceSettings(event.event_data.userId);
      
      // Skip zero amount invoices if configured
      if (!settings.include_zero_amount && event.event_data.amount === 0) {
        logger.debug('Skipping zero amount invoice', { eventId: event.id });
        await this.markEventProcessed(event.id);
        return;
      }

      // Check if we should group daily fees
      if (settings.group_daily_fees && this.isFeesEvent(event.event_type)) {
        // Check if there's already a daily fee invoice for today
        const existingInvoice = await this.getTodaysFeeInvoice(event.event_data.userId);
        if (existingInvoice) {
          await this.addItemToInvoice(existingInvoice, event);
          await this.markEventProcessed(event.id);
          return;
        }
      }

      // Create new invoice
      const invoice = await this.createInvoiceFromEvent(event, invoiceType);
      
      // Mark event as processed
      await this.markEventProcessed(event.id);
      
      // Generate PDF if configured
      if (settings.auto_generate_pdf) {
        await this.generateInvoicePDF(invoice.id);
      }
      
      // Send email if configured
      if (settings.auto_send_email) {
        await this.sendInvoiceEmail(invoice.id);
      }

      logger.info('Invoice created successfully', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        userId: invoice.user_id,
        amount: invoice.total_amount
      });
    } catch (error) {
      logger.error('Failed to process invoice event', {
        eventId: event.id,
        error: error instanceof Error ? error.message : error
      });
      
      await this.handleEventError(event, error);
      throw error;
    }
  }

  /**
   * Create invoice from event data
   */
  private static async createInvoiceFromEvent(
    event: InvoiceEvent,
    invoiceType: InvoiceType
  ): Promise<Invoice> {
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(event.event_data.userId);
    
    // Calculate amounts
    const subtotal = event.event_data.amount || 0;
    const taxAmount = 0; // TODO: Implement tax calculation if needed
    const discountAmount = 0; // TODO: Implement discount logic if needed
    const totalAmount = subtotal + taxAmount - discountAmount;
    
    // Get user profile for invoice details
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('email, phone, metadata')
      .eq('id', event.event_data.userId)
      .single();

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoice_invoices')
      .insert({
        invoice_number: invoiceNumber,
        user_id: event.event_data.userId,
        invoice_type: invoiceType,
        status: 'draft',
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        currency: event.event_data.currency || 'USD',
        invoice_date: new Date().toISOString().split('T')[0],
        reference_type: event.event_data.referenceType,
        reference_id: event.event_data.referenceId,
        metadata: {
          event_id: event.id,
          event_type: event.event_type,
          user_email: userProfile?.email,
          user_phone: userProfile?.phone,
          ...event.event_data
        }
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      throw new AppError('DATABASE_ERROR', `Failed to create invoice: ${invoiceError?.message}`, 500);
    }

    // Create invoice items
    const items = this.createInvoiceItems(event, invoice.id);
    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(items);

      if (itemsError) {
        // Rollback invoice creation
        await supabase.from('invoice_invoices').delete().eq('id', invoice.id);
        throw new AppError('DATABASE_ERROR', `Failed to create invoice items: ${itemsError.message}`, 500);
      }
    }

    // Update invoice status to 'paid' since this represents a completed transaction
    // All invoices generated from successful transactions are automatically paid
    await supabase
      .from('invoice_invoices')
      .update({ 
        status: 'paid',
        paid_date: new Date().toISOString()
      })
      .eq('id', invoice.id);

    return invoice;
  }

  /**
   * Create invoice items based on event type
   */
  private static createInvoiceItems(event: InvoiceEvent, invoiceId: string): Omit<InvoiceItem, 'id' | 'created_at'>[] {
    const items: Omit<InvoiceItem, 'id' | 'created_at'>[] = [];
    
    switch (event.event_type) {
      case 'card_transaction_completed':
        items.push({
          invoice_id: invoiceId,
          description: event.event_data.description || `Transaction at ${event.event_data.merchantName}`,
          quantity: 1,
          unit_price: event.event_data.amount,
          amount: event.event_data.amount,
          tax_rate: 0,
          tax_amount: 0,
          reference_type: 'transaction',
          reference_id: event.event_data.transactionId,
          metadata: {
            merchant_name: event.event_data.merchantName,
            card_id: event.event_data.cardId
          },
          sort_order: 0
        });
        break;

      case 'crypto_deposit_completed':
        items.push({
          invoice_id: invoiceId,
          description: event.event_data.description || 'Cryptocurrency deposit',
          quantity: 1,
          unit_price: event.event_data.amount,
          amount: event.event_data.amount,
          tax_rate: 0,
          tax_amount: 0,
          reference_type: 'crypto_deposit',
          reference_id: event.event_data.referenceId,
          metadata: {
            crypto_amount: event.event_data.cryptoAmount,
            crypto_currency: event.event_data.cryptoCurrency,
            transaction_hash: event.event_data.transactionHash
          },
          sort_order: 0
        });
        break;

      case 'fee_charged':
        items.push({
          invoice_id: invoiceId,
          description: event.event_data.description || `${event.event_data.feeType} fee`,
          quantity: 1,
          unit_price: event.event_data.amount,
          amount: event.event_data.amount,
          tax_rate: 0,
          tax_amount: 0,
          reference_type: 'fee',
          reference_id: event.event_data.referenceId,
          metadata: {
            fee_type: event.event_data.feeType
          },
          sort_order: 0
        });
        break;

      case 'monthly_fee_charged':
        // For monthly fees, create line items for each card
        const feeBreakdown = event.event_data.feeBreakdown || [];
        feeBreakdown.forEach((fee: any, index: number) => {
          items.push({
            invoice_id: invoiceId,
            description: `Monthly fee for card ${fee.cardNumber}`,
            quantity: 1,
            unit_price: fee.amount,
            amount: fee.amount,
            tax_rate: 0,
            tax_amount: 0,
            reference_type: 'card',
            reference_id: fee.cardId,
            metadata: {
              card_number: fee.cardNumber,
              period: event.event_data.period
            },
            sort_order: index
          });
        });
        break;

      default:
        items.push({
          invoice_id: invoiceId,
          description: event.event_data.description || 'Service charge',
          quantity: 1,
          unit_price: event.event_data.amount,
          amount: event.event_data.amount,
          tax_rate: 0,
          tax_amount: 0,
          reference_type: event.event_data.referenceType,
          reference_id: event.event_data.referenceId,
          metadata: event.event_data,
          sort_order: 0
        });
    }

    return items;
  }

  /**
   * Generate invoice number
   */
  private static async generateInvoiceNumber(userId?: string): Promise<string> {
    const { data, error } = await supabase
      .rpc('generate_invoice_number', {
        p_user_id: userId || null
      });

    if (error || !data) {
      // Fallback to simple generation
      const timestamp = Date.now();
      return `INV-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;
    }

    return data;
  }

  /**
   * Get user invoice settings
   */
  private static async getUserInvoiceSettings(userId: string): Promise<InvoiceSettings> {
    // Try to get user-specific settings first
    const { data: userSettings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userSettings) {
      return userSettings;
    }

    // Fall back to global settings
    const { data: globalSettings } = await supabase
      .from('invoice_settings')
      .select('*')
      .is('user_id', null)
      .single();

    if (globalSettings) {
      return globalSettings;
    }

    // Return defaults if no settings found
    return {
      company_name: 'DigiStreets',
      auto_generate_pdf: true,
      auto_send_email: true,
      include_zero_amount: false,
      group_daily_fees: true,
      invoice_prefix: 'INV',
      next_invoice_number: 1
    };
  }

  /**
   * Map event type to invoice type
   */
  private static mapEventTypeToInvoiceType(eventType: string): InvoiceType {
    const mapping: Record<string, InvoiceType> = {
      'card_transaction_completed': 'card_transaction',
      'crypto_deposit_completed': 'crypto_deposit',
      'crypto_withdrawal_completed': 'crypto_withdrawal',
      'monthly_fee_charged': 'monthly_fee',
      'card_created': 'card_creation_fee',
      'fee_charged': 'deposit_fee' // Default, but can vary based on fee_type
    };

    return mapping[eventType] || 'manual';
  }

  /**
   * Check if event is a fee event
   */
  private static isFeesEvent(eventType: string): boolean {
    return ['fee_charged', 'card_created'].includes(eventType);
  }

  /**
   * Check if transaction was successful and should generate an invoice
   * CRITICAL: Only successful/completed transactions should have invoices
   */
  private static isSuccessfulTransaction(event: InvoiceEvent): boolean {
    const eventType = event.event_type;
    const eventData = event.event_data;

    // Check based on event type
    switch (eventType) {
      case 'card_transaction_completed':
        // Only completed/successful card transactions
        return eventData.status === 'completed' || eventData.status === 'success' || 
               eventData.status === 'captured' || !eventData.status; // Default to true if no status
      
      case 'crypto_deposit_completed':
        // Only confirmed crypto deposits
        return eventData.status === 'completed' || eventData.status === 'confirmed' || 
               eventData.confirmations >= (eventData.requiredConfirmations || 1);
      
      case 'crypto_withdrawal_completed':
        // Only successful withdrawals
        return eventData.status === 'completed' || eventData.status === 'success';
      
      case 'card_created':
        // Only when card was actually created successfully
        return eventData.status === 'active' || eventData.status === 'created' || 
               eventData.cardId; // If we have cardId, it was created
      
      case 'monthly_fee_charged':
      case 'fee_charged':
        // Only when fee was actually charged/deducted
        return eventData.status === 'charged' || eventData.status === 'completed' || 
               eventData.charged === true || eventData.amount > 0;
      
      default:
        // For other event types, check for general success indicators
        return eventData.status === 'completed' || eventData.status === 'success' || 
               eventData.success === true || !eventData.status; // Default to true if no status
    }
  }

  /**
   * Get today's fee invoice for grouping
   */
  private static async getTodaysFeeInvoice(userId: string): Promise<Invoice | null> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('invoice_invoices')
      .select('*')
      .eq('user_id', userId)
      .eq('invoice_type', 'consolidated')
      .eq('invoice_date', today)
      .eq('status', 'draft')
      .single();

    return data;
  }

  /**
   * Add item to existing invoice
   */
  private static async addItemToInvoice(invoice: Invoice, event: InvoiceEvent): Promise<void> {
    const items = this.createInvoiceItems(event, invoice.id);
    
    if (items.length > 0) {
      await supabase
        .from('invoice_items')
        .insert(items);

      // Update invoice totals
      const newSubtotal = invoice.subtotal + event.event_data.amount;
      const newTotal = newSubtotal + invoice.tax_amount - invoice.discount_amount;

      await supabase
        .from('invoice_invoices')
        .update({
          subtotal: newSubtotal,
          total_amount: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);
    }
  }

  /**
   * Mark event as processed
   */
  private static async markEventProcessed(eventId: string): Promise<void> {
    await supabase
      .from('invoice_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('id', eventId);
  }

  /**
   * Handle event processing error
   */
  private static async handleEventError(event: InvoiceEvent, error: any): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const newRetryCount = event.retry_count + 1;

    await supabase
      .from('invoice_events')
      .update({
        error_message: errorMessage,
        retry_count: newRetryCount
      })
      .eq('id', event.id);

    // If max retries exceeded, move to failed events
    if (newRetryCount >= 3) {
      await supabase
        .from('invoice_failed_events')
        .insert({
          event_data: event,
          error_message: errorMessage,
          retry_count: newRetryCount
        });
    }
  }

  /**
   * Generate PDF for invoice
   */
  private static async generateInvoicePDF(invoiceId: string): Promise<void> {
    const { PDFService } = await import('./pdfService');
    await PDFService.generateInvoicePDF(invoiceId);
    logger.info('PDF generated successfully', { invoiceId });
  }

  /**
   * Send invoice email
   */
  private static async sendInvoiceEmail(invoiceId: string): Promise<void> {
    const { EmailService } = await import('./emailService');
    await EmailService.sendInvoiceEmail(invoiceId);
    logger.info('Email sent successfully', { invoiceId });
  }

  /**
   * Get invoice by ID
   */
  static async getInvoice(invoiceId: string, userId: string): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoice_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    }

    return data;
  }

  /**
   * List user invoices with pagination
   */
  static async listInvoices(
    userId: string,
    filters: {
      status?: InvoiceStatus;
      type?: InvoiceType;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('invoice_invoices')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.type) {
      query = query.eq('invoice_type', filters.type);
    }

    if (filters.from) {
      query = query.gte('invoice_date', filters.from);
    }

    if (filters.to) {
      query = query.lte('invoice_date', filters.to);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError('DATABASE_ERROR', error.message, 500);
    }

    return {
      invoices: data || [],
      total: count || 0
    };
  }

  /**
   * Get invoice items
   */
  static async getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    if (error) {
      throw new AppError('DATABASE_ERROR', error.message, 500);
    }

    return data || [];
  }

  /**
   * Get user invoice settings (public method)
   */
  static async getUserSettings(userId: string): Promise<InvoiceSettings> {
    return this.getUserInvoiceSettings(userId);
  }

  /**
   * Update user invoice settings
   */
  static async updateUserSettings(userId: string, settings: Partial<InvoiceSettings>): Promise<InvoiceSettings> {
    // Check if user has settings
    const { data: existingSettings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingSettings) {
      // Update existing settings
      const { data, error } = await supabase
        .from('invoice_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new AppError('DATABASE_ERROR', `Failed to update settings: ${error.message}`, 500);
      }

      return data;
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from('invoice_settings')
        .insert({
          user_id: userId,
          ...settings
        })
        .select()
        .single();

      if (error) {
        throw new AppError('DATABASE_ERROR', `Failed to create settings: ${error.message}`, 500);
      }

      return data;
    }
  }
}