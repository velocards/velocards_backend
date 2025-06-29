"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PDFService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
class PDFService {
    /**
     * Generate PDF for an invoice
     */
    static async generateInvoicePDF(invoiceId) {
        try {
            logger_1.default.info('Starting PDF generation', { invoiceId });
            // Get invoice data with items and user profile
            const invoiceData = await this.getInvoiceData(invoiceId);
            // Generate HTML content
            const htmlContent = this.generateInvoiceHTML(invoiceData);
            // Convert HTML to PDF
            const pdfBuffer = await this.convertHTMLToPDF(htmlContent);
            // Upload to Supabase Storage
            const pdfUrl = await this.uploadPDFToStorage(invoiceId, pdfBuffer);
            // Update invoice with PDF URL
            await database_1.supabase
                .from('invoice_invoices')
                .update({
                pdf_url: pdfUrl,
                pdf_generated_at: new Date().toISOString()
            })
                .eq('id', invoiceId);
            logger_1.default.info('PDF generated successfully', { invoiceId, pdfUrl });
            return pdfUrl;
        }
        catch (error) {
            logger_1.default.error('Failed to generate PDF', { invoiceId, error });
            throw new errors_1.AppError('PDF_GENERATION_FAILED', 'Failed to generate invoice PDF', 500);
        }
    }
    /**
     * Get complete invoice data including items and user profile
     */
    static async getInvoiceData(invoiceId) {
        // Get invoice
        const { data: invoice, error: invoiceError } = await database_1.supabase
            .from('invoice_invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();
        if (invoiceError || !invoice) {
            throw new errors_1.AppError('NOT_FOUND', 'Invoice not found', 404);
        }
        // Get invoice items
        const { data: items, error: itemsError } = await database_1.supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('sort_order');
        if (itemsError) {
            throw new errors_1.AppError('DATABASE_ERROR', 'Failed to fetch invoice items', 500);
        }
        // Get user profile
        const { data: user, error: userError } = await database_1.supabase
            .from('user_profiles')
            .select('email, metadata')
            .eq('id', invoice.user_id)
            .single();
        if (userError || !user) {
            throw new errors_1.AppError('NOT_FOUND', 'User not found', 404);
        }
        return {
            invoice,
            items: items || [],
            user: {
                email: user.email,
                firstName: user.metadata?.firstName || '',
                lastName: user.metadata?.lastName || '',
                phone: user.metadata?.phone || '',
                metadata: user.metadata
            }
        };
    }
    /**
     * Generate HTML content for invoice PDF
     */
    static generateInvoiceHTML(data) {
        const { invoice, items, user } = data;
        // Company branding
        const branding = {
            companyName: 'VeloCards',
            brandColor: '#7c3aed', // Purple - VeloCards brand color
            address: 'B-1710, 17th Floor, Tower B, GYGY Mentis, Plot No-2, Sector 140, Noida, UP, India, 201305',
            phone: '', // Contact via email
            email: 'support@velocards.com',
            website: 'https://velocards.com'
        };
        const formatDate = (dateString) => {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };
        const formatCurrency = (amount, currency = 'USD') => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency
            }).format(amount);
        };
        return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background: #fff;
            }
            
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 40px;
                background: white;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid ${branding.brandColor};
            }
            
            .company-info {
                flex: 1;
            }
            
            .company-name {
                font-size: 28px;
                font-weight: bold;
                color: ${branding.brandColor};
                margin-bottom: 10px;
            }
            
            .company-details {
                font-size: 14px;
                color: #666;
                line-height: 1.4;
            }
            
            .invoice-info {
                text-align: right;
                flex: 1;
            }
            
            .invoice-title {
                font-size: 24px;
                font-weight: bold;
                color: #333;
                margin-bottom: 10px;
            }
            
            .invoice-number {
                font-size: 18px;
                color: ${branding.brandColor};
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .invoice-meta {
                font-size: 14px;
                color: #666;
            }
            
            .customer-info {
                margin-bottom: 40px;
            }
            
            .section-title {
                font-size: 16px;
                font-weight: bold;
                color: #333;
                margin-bottom: 10px;
                padding-bottom: 5px;
                border-bottom: 1px solid #eee;
            }
            
            .customer-details {
                background: #f9f9f9;
                padding: 20px;
                border-radius: 8px;
                font-size: 14px;
            }
            
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            
            .items-table th {
                background: ${branding.brandColor};
                color: white;
                padding: 12px;
                text-align: left;
                font-weight: bold;
                font-size: 14px;
            }
            
            .items-table td {
                padding: 12px;
                border-bottom: 1px solid #eee;
                font-size: 14px;
            }
            
            .items-table tr:nth-child(even) {
                background: #f9f9f9;
            }
            
            .text-right {
                text-align: right;
            }
            
            .text-center {
                text-align: center;
            }
            
            .totals {
                margin-left: auto;
                width: 300px;
            }
            
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }
            
            .totals-row.total {
                font-weight: bold;
                font-size: 18px;
                color: ${branding.brandColor};
                border-top: 2px solid ${branding.brandColor};
                border-bottom: 2px solid ${branding.brandColor};
                margin-top: 10px;
            }
            
            .status-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .status-paid {
                background: #10b981;
                color: white;
            }
            
            .status-pending {
                background: #f59e0b;
                color: white;
            }
            
            .status-overdue {
                background: #ef4444;
                color: white;
            }
            
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                font-size: 12px;
                color: #666;
                text-align: center;
            }
            
            .notes {
                margin-top: 30px;
                padding: 20px;
                background: #f3f4f6;
                border-radius: 8px;
            }
            
            .notes-title {
                font-weight: bold;
                margin-bottom: 10px;
                color: #374151;
            }
            
            @media print {
                .invoice-container {
                    padding: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="header">
                <div class="company-info">
                    <div class="company-name">${branding.companyName}</div>
                    <div class="company-details">
                        ${branding.address}<br>
                        Email: ${branding.email}<br>
                        Website: ${branding.website}
                    </div>
                </div>
                <div class="invoice-info">
                    <div class="invoice-title">INVOICE</div>
                    <div class="invoice-number">${invoice.invoice_number}</div>
                    <div class="invoice-meta">
                        <div>Date: ${formatDate(invoice.invoice_date)}</div>
                        ${invoice.due_date ? `<div>Due: ${formatDate(invoice.due_date)}</div>` : ''}
                        ${invoice.paid_date ? `<div>Paid: ${formatDate(invoice.paid_date)}</div>` : ''}
                        <div style="margin-top: 10px;">
                            <span class="status-badge status-${invoice.status}">${invoice.status}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Customer Information -->
            <div class="customer-info">
                <div class="section-title">Bill To</div>
                <div class="customer-details">
                    <strong>${user.firstName} ${user.lastName}</strong><br>
                    Email: ${user.email}<br>
                    ${user.phone ? `Phone: ${user.phone}<br>` : ''}
                    Customer ID: ${invoice.user_id}
                </div>
            </div>
            
            <!-- Items Table -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => `
                        <tr>
                            <td>
                                <strong>${item.description}</strong>
                                ${item.metadata?.merchant_name ? `<br><small>Merchant: ${item.metadata.merchant_name}</small>` : ''}
                                ${item.metadata?.card_number ? `<br><small>Card: ${item.metadata.card_number}</small>` : ''}
                                ${item.metadata?.crypto_currency ? `<br><small>Crypto: ${item.metadata.crypto_currency}</small>` : ''}
                            </td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">${formatCurrency(item.unit_price, invoice.currency)}</td>
                            <td class="text-right">${formatCurrency(item.amount, invoice.currency)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals">
                <div class="totals-row">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                ${invoice.tax_amount > 0 ? `
                <div class="totals-row">
                    <span>Tax:</span>
                    <span>${formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                </div>
                ` : ''}
                ${invoice.discount_amount > 0 ? `
                <div class="totals-row">
                    <span>Discount:</span>
                    <span>-${formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                </div>
                ` : ''}
                <div class="totals-row total">
                    <span>Total:</span>
                    <span>${formatCurrency(invoice.total_amount, invoice.currency)}</span>
                </div>
            </div>
            
            <!-- Notes -->
            ${invoice.notes ? `
            <div class="notes">
                <div class="notes-title">Notes</div>
                <div>${invoice.notes}</div>
            </div>
            ` : ''}
            
            <!-- Footer -->
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>This invoice was generated automatically by ${branding.companyName} on ${formatDate(new Date().toISOString())}</p>
                <p>For questions about this invoice, please contact ${branding.email}</p>
                <p style="margin-top: 10px; font-size: 10px;">VeloCards - Virtual Card Solutions</p>
            </div>
        </div>
    </body>
    </html>
    `;
    }
    /**
     * Convert HTML to PDF using Puppeteer
     */
    static async convertHTMLToPDF(htmlContent) {
        let browser;
        try {
            browser = await puppeteer_1.default.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });
            return Buffer.from(pdfBuffer);
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    /**
     * Upload PDF to Supabase Storage
     */
    static async uploadPDFToStorage(invoiceId, pdfBuffer) {
        const fileName = `invoice-${invoiceId}-${Date.now()}.pdf`;
        const filePath = `invoices/${fileName}`;
        try {
            const { error } = await database_1.supabase.storage
                .from('documents')
                .upload(filePath, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: false
            });
            if (error) {
                // If bucket doesn't exist, provide helpful error message
                if (error.message.includes('bucket') || error.message.includes('not found')) {
                    throw new errors_1.AppError('STORAGE_BUCKET_MISSING', 'Storage bucket not configured. Please create "documents" bucket in Supabase Storage.', 500);
                }
                throw new errors_1.AppError('STORAGE_ERROR', `Failed to upload PDF: ${error.message}`, 500);
            }
            // Get public URL
            const { data: urlData } = database_1.supabase.storage
                .from('documents')
                .getPublicUrl(filePath);
            return urlData.publicUrl;
        }
        catch (error) {
            logger_1.default.error('PDF storage upload failed', { invoiceId, error });
            // Fallback: return a placeholder URL for development
            if (process.env['NODE_ENV'] === 'development') {
                logger_1.default.warn('Using placeholder PDF URL in development mode');
                return `https://placeholder-pdf-url.com/invoice-${invoiceId}.pdf`;
            }
            throw error;
        }
    }
    /**
     * Download PDF for an invoice
     */
    static async downloadInvoicePDF(invoiceId, userId) {
        // Verify user can access this invoice
        const { data: invoice, error } = await database_1.supabase
            .from('invoice_invoices')
            .select('invoice_number, pdf_url')
            .eq('id', invoiceId)
            .eq('user_id', userId)
            .single();
        if (error || !invoice) {
            throw new errors_1.AppError('NOT_FOUND', 'Invoice not found', 404);
        }
        // If PDF doesn't exist, generate it
        if (!invoice.pdf_url) {
            await this.generateInvoicePDF(invoiceId);
            // Re-fetch invoice to get PDF URL
            const { data: updatedInvoice } = await database_1.supabase
                .from('invoice_invoices')
                .select('invoice_number, pdf_url')
                .eq('id', invoiceId)
                .single();
            if (!updatedInvoice?.pdf_url) {
                throw new errors_1.AppError('PDF_GENERATION_FAILED', 'Failed to generate PDF', 500);
            }
            invoice.pdf_url = updatedInvoice.pdf_url;
        }
        // Download PDF from storage
        const filePath = invoice.pdf_url.split('/').pop();
        const { data, error: downloadError } = await database_1.supabase.storage
            .from('documents')
            .download(`invoices/${filePath}`);
        if (downloadError || !data) {
            throw new errors_1.AppError('DOWNLOAD_ERROR', 'Failed to download PDF', 500);
        }
        const buffer = Buffer.from(await data.arrayBuffer());
        const filename = `${invoice.invoice_number}.pdf`;
        return { buffer, filename };
    }
}
exports.PDFService = PDFService;
//# sourceMappingURL=pdfService.js.map