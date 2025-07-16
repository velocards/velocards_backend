"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
const env_1 = require("../config/env");
const emailProvider_1 = require("./emailProvider");
class EmailService {
    /**
     * Check if email service is ready
     */
    static isReady() {
        return emailProvider_1.emailProvider.getActiveProvider() !== 'Console';
    }
    /**
     * Send invoice email to user
     */
    static async sendInvoiceEmail(invoiceId) {
        try {
            if (!this.isReady()) {
                logger_1.default.warn('Email service not initialized, skipping email send', { invoiceId });
                return;
            }
            logger_1.default.info('Sending invoice email', { invoiceId });
            // Get invoice data
            const emailData = await this.getInvoiceEmailData(invoiceId);
            // Generate email template
            const template = this.generateInvoiceEmailTemplate(emailData);
            // Prepare attachments
            const attachments = [];
            if (emailData.pdfUrl) {
                try {
                    // Download PDF from Supabase storage
                    const pdfPath = emailData.pdfUrl.split('/').pop();
                    const { data: pdfData, error } = await database_1.supabase.storage
                        .from('documents')
                        .download(`invoices/${pdfPath}`);
                    if (!error && pdfData) {
                        // Convert blob to base64
                        const buffer = Buffer.from(await pdfData.arrayBuffer());
                        attachments.push({
                            filename: `${emailData.invoice.invoice_number}.pdf`,
                            content: buffer.toString('base64'),
                            type: 'application/pdf',
                            disposition: 'attachment'
                        });
                    }
                    else {
                        logger_1.default.warn('Failed to download PDF for email attachment', { invoiceId, error });
                    }
                }
                catch (err) {
                    logger_1.default.warn('Error preparing PDF attachment', { invoiceId, error: err });
                }
            }
            if (attachments.length > 0) {
                await this.sendEmailInternal({
                    to: emailData.user.email,
                    subject: template.subject,
                    html: template.htmlContent,
                    text: template.textContent,
                    attachments: attachments
                });
            }
            else {
                await this.sendEmailInternal({
                    to: emailData.user.email,
                    subject: template.subject,
                    html: template.htmlContent,
                    text: template.textContent
                });
            }
            // Log email sent
            await this.logEmailSent(invoiceId, emailData.user.email, template.subject);
            // Update invoice
            await database_1.supabase
                .from('invoice_invoices')
                .update({
                email_sent_at: new Date().toISOString()
            })
                .eq('id', invoiceId);
            logger_1.default.info('Invoice email sent successfully', {
                invoiceId,
                email: emailData.user.email,
                invoiceNumber: emailData.invoice.invoice_number
            });
        }
        catch (error) {
            logger_1.default.error('Failed to send invoice email', { invoiceId, error });
            throw new errors_1.AppError('EMAIL_SEND_FAILED', 'Failed to send invoice email', 500);
        }
    }
    /**
     * Get invoice data for email
     */
    static async getInvoiceEmailData(invoiceId) {
        // Get invoice
        const { data: invoice, error: invoiceError } = await database_1.supabase
            .from('invoice_invoices')
            .select('id, invoice_number, total_amount, currency, invoice_date, due_date, status, user_id, pdf_url')
            .eq('id', invoiceId)
            .single();
        if (invoiceError || !invoice) {
            throw new errors_1.AppError('NOT_FOUND', 'Invoice not found', 404);
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
            invoice: {
                id: invoice.id,
                invoice_number: invoice.invoice_number,
                total_amount: invoice.total_amount,
                currency: invoice.currency,
                invoice_date: invoice.invoice_date,
                due_date: invoice.due_date,
                status: invoice.status
            },
            user: {
                email: user.email,
                firstName: user.metadata?.firstName || '',
                lastName: user.metadata?.lastName || ''
            },
            pdfUrl: invoice.pdf_url
        };
    }
    /**
     * Generate invoice email template
     */
    static generateInvoiceEmailTemplate(data) {
        const { invoice, user } = data;
        const userName = user.firstName ? `${user.firstName} ${user.lastName}`.trim() : user.email;
        const formatCurrency = (amount, currency = 'USD') => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency
            }).format(amount);
        };
        const formatDate = (dateString) => {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };
        const subject = `Invoice ${invoice.invoice_number} - ${formatCurrency(invoice.total_amount, invoice.currency)}`;
        const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f9f9f9;
            }
            .email-container {
                background: white;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #2563eb;
            }
            .company-name {
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 5px;
            }
            .invoice-title {
                font-size: 20px;
                color: #333;
                margin-bottom: 20px;
            }
            .invoice-details {
                background: #f8fafc;
                padding: 20px;
                border-radius: 6px;
                margin: 20px 0;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                padding: 5px 0;
            }
            .detail-label {
                font-weight: bold;
                color: #4b5563;
            }
            .detail-value {
                color: #1f2937;
            }
            .amount-highlight {
                font-size: 18px;
                font-weight: bold;
                color: #2563eb;
            }
            .status-badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
                background: #10b981;
                color: white;
            }
            .cta-button {
                display: inline-block;
                background: #2563eb;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: bold;
                margin: 20px 0;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
            .greeting {
                margin-bottom: 20px;
                font-size: 16px;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="company-name">VeloCards</div>
                <div class="invoice-title">Invoice ${invoice.invoice_number}</div>
            </div>
            
            <div class="greeting">
                Hello ${userName},
            </div>
            
            <p>Thank you for your business! Your invoice is ready and attached to this email.</p>
            
            <div class="invoice-details">
                <div class="detail-row">
                    <span class="detail-label">Invoice Number:</span>
                    <span class="detail-value">${invoice.invoice_number}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Invoice Date:</span>
                    <span class="detail-value">${formatDate(invoice.invoice_date)}</span>
                </div>
                ${invoice.due_date ? `
                <div class="detail-row">
                    <span class="detail-label">Due Date:</span>
                    <span class="detail-value">${formatDate(invoice.due_date)}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <span class="status-badge">${invoice.status}</span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Total Amount:</span>
                    <span class="detail-value amount-highlight">${formatCurrency(invoice.total_amount, invoice.currency)}</span>
                </div>
            </div>
            
            ${invoice.status === 'paid' ? `
            <p>✅ <strong>This invoice has been paid.</strong> Thank you for your payment!</p>
            ` : `
            <p>This invoice represents your recent activity with VeloCards. If you have any questions about this invoice, please don't hesitate to contact our support team.</p>
            `}
            
            <div class="footer">
                <p><strong>VeloCards</strong></p>
                <p>Email: support@velocards.com</p>
                <p>B-1710, 17th Floor, Tower B, GYGY Mentis, Plot No-2,<br>Sector 140, Noida, UP, India, 201305</p>
                <p style="margin-top: 10px; font-size: 12px;">
                    This is an automated email. Please do not reply to this message.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
        const textContent = `
VeloCards - Invoice ${invoice.invoice_number}

Hello ${userName},

Thank you for your business! Your invoice is ready.

Invoice Details:
- Invoice Number: ${invoice.invoice_number}
- Invoice Date: ${formatDate(invoice.invoice_date)}
${invoice.due_date ? `- Due Date: ${formatDate(invoice.due_date)}\n` : ''}
- Status: ${invoice.status.toUpperCase()}
- Total Amount: ${formatCurrency(invoice.total_amount, invoice.currency)}

${invoice.status === 'paid' ?
            '✅ This invoice has been paid. Thank you for your payment!' :
            'This invoice represents your recent activity with VeloCards. If you have any questions about this invoice, please don\'t hesitate to contact our support team.'}

VeloCards
Email: support@velocards.com
B-1710, 17th Floor, Tower B, GYGY Mentis, Plot No-2,
Sector 140, Noida, UP, India, 201305

This is an automated email. Please do not reply to this message.
    `;
        return {
            subject,
            htmlContent,
            textContent
        };
    }
    /**
     * Send email using configured provider
     */
    static async sendEmailInternal(options) {
        const fromEmail = env_1.env.INVOICE_FROM_EMAIL || 'invoices@velocards.com';
        const fromName = env_1.env.INVOICE_FROM_NAME || 'VeloCards Finance';
        const emailOptions = {
            to: options.to,
            from: {
                email: fromEmail,
                name: fromName
            },
            subject: options.subject,
            text: options.text,
            html: options.html,
            ...(options.attachments && { attachments: options.attachments })
        };
        await emailProvider_1.emailProvider.send(emailOptions);
    }
    /**
     * Log email sent to database
     */
    static async logEmailSent(invoiceId, recipientEmail, subject) {
        try {
            await database_1.supabase
                .from('invoice_email_logs')
                .insert({
                invoice_id: invoiceId,
                recipient_email: recipientEmail,
                subject: subject,
                sent_at: new Date().toISOString(),
                status: 'sent'
            });
        }
        catch (error) {
            // Log but don't throw - email was sent successfully
            logger_1.default.warn('Failed to log email send', { invoiceId, error });
        }
    }
    /**
     * Resend invoice email
     */
    static async resendInvoiceEmail(invoiceId, userId) {
        // Verify user can access this invoice
        const { data: invoice, error } = await database_1.supabase
            .from('invoice_invoices')
            .select('id')
            .eq('id', invoiceId)
            .eq('user_id', userId)
            .single();
        if (error || !invoice) {
            throw new errors_1.AppError('NOT_FOUND', 'Invoice not found', 404);
        }
        // Send email
        await this.sendInvoiceEmail(invoiceId);
    }
    /**
     * Send test email (for setup verification)
     */
    static async sendTestEmail(to) {
        if (!this.isReady()) {
            throw new errors_1.AppError('EMAIL_NOT_CONFIGURED', 'Email service not configured', 500);
        }
        await this.sendEmailInternal({
            to,
            subject: 'VeloCards Email Service Test',
            html: `
        <h2>Email Service Test</h2>
        <p>This is a test email to verify that the VeloCards email service is working correctly.</p>
        <p>If you receive this email, the email integration is configured properly.</p>
        <hr>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
            text: `
VeloCards Email Service Test

This is a test email to verify that the VeloCards email service is working correctly.

If you receive this email, the email integration is configured properly.

Sent at: ${new Date().toISOString()}
      `
        });
        logger_1.default.info('Test email sent successfully', { to });
    }
    /**
     * Public method to send email (for password reset and other services)
     */
    static async sendEmail(options) {
        const fromEmail = options.from?.email || env_1.env.FROM_EMAIL || 'noreply@velocards.com';
        const fromName = options.from?.name || env_1.env.FROM_NAME || 'VeloCards';
        const emailOptions = {
            to: options.to,
            from: {
                email: fromEmail,
                name: fromName
            },
            subject: options.subject,
            text: options.text,
            html: options.html,
            ...(options.attachments && { attachments: options.attachments })
        };
        await emailProvider_1.emailProvider.send(emailOptions);
        logger_1.default.info('Email sent successfully', {
            to: options.to,
            subject: options.subject,
            provider: emailProvider_1.emailProvider.getActiveProvider()
        });
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=emailService.js.map