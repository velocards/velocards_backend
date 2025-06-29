type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'failed';
type InvoiceType = 'card_transaction' | 'crypto_deposit' | 'crypto_withdrawal' | 'monthly_fee' | 'card_creation_fee' | 'deposit_fee' | 'manual' | 'consolidated';
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
export declare class InvoiceService {
    /**
     * Process a single invoice event
     */
    static processInvoiceEvent(event: InvoiceEvent): Promise<void>;
    /**
     * Create invoice from event data
     */
    private static createInvoiceFromEvent;
    /**
     * Create invoice items based on event type
     */
    private static createInvoiceItems;
    /**
     * Generate invoice number
     */
    private static generateInvoiceNumber;
    /**
     * Get user invoice settings
     */
    private static getUserInvoiceSettings;
    /**
     * Map event type to invoice type
     */
    private static mapEventTypeToInvoiceType;
    /**
     * Check if event is a fee event
     */
    private static isFeesEvent;
    /**
     * Check if transaction was successful and should generate an invoice
     * CRITICAL: Only successful/completed transactions should have invoices
     */
    private static isSuccessfulTransaction;
    /**
     * Get today's fee invoice for grouping
     */
    private static getTodaysFeeInvoice;
    /**
     * Add item to existing invoice
     */
    private static addItemToInvoice;
    /**
     * Mark event as processed
     */
    private static markEventProcessed;
    /**
     * Handle event processing error
     */
    private static handleEventError;
    /**
     * Generate PDF for invoice
     */
    private static generateInvoicePDF;
    /**
     * Send invoice email
     */
    private static sendInvoiceEmail;
    /**
     * Get invoice by ID
     */
    static getInvoice(invoiceId: string, userId: string): Promise<Invoice>;
    /**
     * List user invoices with pagination
     */
    static listInvoices(userId: string, filters: {
        status?: InvoiceStatus;
        type?: InvoiceType;
        from?: string;
        to?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        invoices: Invoice[];
        total: number;
    }>;
    /**
     * Get invoice items
     */
    static getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]>;
    /**
     * Get user invoice settings (public method)
     */
    static getUserSettings(userId: string): Promise<InvoiceSettings>;
    /**
     * Update user invoice settings
     */
    static updateUserSettings(userId: string, settings: Partial<InvoiceSettings>): Promise<InvoiceSettings>;
}
export {};
//# sourceMappingURL=invoiceService.d.ts.map