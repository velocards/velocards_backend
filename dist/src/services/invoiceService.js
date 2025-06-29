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
exports.InvoiceService = void 0;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
class InvoiceService {
    /**
     * Process a single invoice event
     */
    static async processInvoiceEvent(event) {
        try {
            logger_1.default.info('Processing invoice event', {
                eventId: event.id,
                eventType: event.event_type,
                userId: event.event_data.userId
            });
            // CRITICAL: Only process events for successful/completed transactions
            if (!this.isSuccessfulTransaction(event)) {
                logger_1.default.debug('Skipping invoice for non-successful transaction', {
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
                logger_1.default.debug('Skipping zero amount invoice', { eventId: event.id });
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
            logger_1.default.info('Invoice created successfully', {
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoice_number,
                userId: invoice.user_id,
                amount: invoice.total_amount
            });
        }
        catch (error) {
            logger_1.default.error('Failed to process invoice event', {
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
    static async createInvoiceFromEvent(event, invoiceType) {
        // Generate invoice number
        const invoiceNumber = await this.generateInvoiceNumber(event.event_data.userId);
        // Calculate amounts
        const subtotal = event.event_data.amount || 0;
        const taxAmount = 0; // TODO: Implement tax calculation if needed
        const discountAmount = 0; // TODO: Implement discount logic if needed
        const totalAmount = subtotal + taxAmount - discountAmount;
        // Get user profile for invoice details
        const { data: userProfile } = await database_1.supabase
            .from('user_profiles')
            .select('email, phone, metadata')
            .eq('id', event.event_data.userId)
            .single();
        // Create invoice
        const { data: invoice, error: invoiceError } = await database_1.supabase
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
            throw new errors_1.AppError('DATABASE_ERROR', `Failed to create invoice: ${invoiceError?.message}`, 500);
        }
        // Create invoice items
        const items = this.createInvoiceItems(event, invoice.id);
        if (items.length > 0) {
            const { error: itemsError } = await database_1.supabase
                .from('invoice_items')
                .insert(items);
            if (itemsError) {
                // Rollback invoice creation
                await database_1.supabase.from('invoice_invoices').delete().eq('id', invoice.id);
                throw new errors_1.AppError('DATABASE_ERROR', `Failed to create invoice items: ${itemsError.message}`, 500);
            }
        }
        // Update invoice status to 'paid' since this represents a completed transaction
        // All invoices generated from successful transactions are automatically paid
        await database_1.supabase
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
    static createInvoiceItems(event, invoiceId) {
        const items = [];
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
                feeBreakdown.forEach((fee, index) => {
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
    static async generateInvoiceNumber(userId) {
        const { data, error } = await database_1.supabase
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
    static async getUserInvoiceSettings(userId) {
        // Try to get user-specific settings first
        const { data: userSettings } = await database_1.supabase
            .from('invoice_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (userSettings) {
            return userSettings;
        }
        // Fall back to global settings
        const { data: globalSettings } = await database_1.supabase
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
    static mapEventTypeToInvoiceType(eventType) {
        const mapping = {
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
    static isFeesEvent(eventType) {
        return ['fee_charged', 'card_created'].includes(eventType);
    }
    /**
     * Check if transaction was successful and should generate an invoice
     * CRITICAL: Only successful/completed transactions should have invoices
     */
    static isSuccessfulTransaction(event) {
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
    static async getTodaysFeeInvoice(userId) {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await database_1.supabase
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
    static async addItemToInvoice(invoice, event) {
        const items = this.createInvoiceItems(event, invoice.id);
        if (items.length > 0) {
            await database_1.supabase
                .from('invoice_items')
                .insert(items);
            // Update invoice totals
            const newSubtotal = invoice.subtotal + event.event_data.amount;
            const newTotal = newSubtotal + invoice.tax_amount - invoice.discount_amount;
            await database_1.supabase
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
    static async markEventProcessed(eventId) {
        await database_1.supabase
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
    static async handleEventError(event, error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const newRetryCount = event.retry_count + 1;
        await database_1.supabase
            .from('invoice_events')
            .update({
            error_message: errorMessage,
            retry_count: newRetryCount
        })
            .eq('id', event.id);
        // If max retries exceeded, move to failed events
        if (newRetryCount >= 3) {
            await database_1.supabase
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
    static async generateInvoicePDF(invoiceId) {
        const { PDFService } = await Promise.resolve().then(() => __importStar(require('./pdfService')));
        await PDFService.generateInvoicePDF(invoiceId);
        logger_1.default.info('PDF generated successfully', { invoiceId });
    }
    /**
     * Send invoice email
     */
    static async sendInvoiceEmail(invoiceId) {
        const { EmailService } = await Promise.resolve().then(() => __importStar(require('./emailService')));
        await EmailService.sendInvoiceEmail(invoiceId);
        logger_1.default.info('Email sent successfully', { invoiceId });
    }
    /**
     * Get invoice by ID
     */
    static async getInvoice(invoiceId, userId) {
        const { data, error } = await database_1.supabase
            .from('invoice_invoices')
            .select('*')
            .eq('id', invoiceId)
            .eq('user_id', userId)
            .single();
        if (error || !data) {
            throw new errors_1.AppError('NOT_FOUND', 'Invoice not found', 404);
        }
        return data;
    }
    /**
     * List user invoices with pagination
     */
    static async listInvoices(userId, filters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;
        let query = database_1.supabase
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
            throw new errors_1.AppError('DATABASE_ERROR', error.message, 500);
        }
        return {
            invoices: data || [],
            total: count || 0
        };
    }
    /**
     * Get invoice items
     */
    static async getInvoiceItems(invoiceId) {
        const { data, error } = await database_1.supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('sort_order');
        if (error) {
            throw new errors_1.AppError('DATABASE_ERROR', error.message, 500);
        }
        return data || [];
    }
    /**
     * Get user invoice settings (public method)
     */
    static async getUserSettings(userId) {
        return this.getUserInvoiceSettings(userId);
    }
    /**
     * Update user invoice settings
     */
    static async updateUserSettings(userId, settings) {
        // Check if user has settings
        const { data: existingSettings } = await database_1.supabase
            .from('invoice_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (existingSettings) {
            // Update existing settings
            const { data, error } = await database_1.supabase
                .from('invoice_settings')
                .update({
                ...settings,
                updated_at: new Date().toISOString()
            })
                .eq('user_id', userId)
                .select()
                .single();
            if (error) {
                throw new errors_1.AppError('DATABASE_ERROR', `Failed to update settings: ${error.message}`, 500);
            }
            return data;
        }
        else {
            // Create new settings
            const { data, error } = await database_1.supabase
                .from('invoice_settings')
                .insert({
                user_id: userId,
                ...settings
            })
                .select()
                .single();
            if (error) {
                throw new errors_1.AppError('DATABASE_ERROR', `Failed to create settings: ${error.message}`, 500);
            }
            return data;
        }
    }
}
exports.InvoiceService = InvoiceService;
//# sourceMappingURL=invoiceService.js.map