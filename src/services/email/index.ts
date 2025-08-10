/**
 * Email Service
 * Main entry point for all email operations
 * Provides backward compatibility with existing code
 */

import { UnifiedEmailService } from './unifiedEmailService';
import { EmailOptions, EmailTemplate } from './types';
import { supabase } from '../../config/database';
import logger from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { env } from '../../config/env';

// Initialize the unified email service
const unifiedEmailService = new UnifiedEmailService();

/**
 * Main Email Service class
 * Provides backward compatibility with existing EmailService
 */
export class EmailService {
  /**
   * Check if email service is ready
   */
  static async isReady(): Promise<boolean> {
    const health = await unifiedEmailService.getHealthStatus();
    return health.providers.some(p => p.configured && p.healthy);
  }

  /**
   * Send email using unified service
   */
  static async sendEmail(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: any[];
    from?: {
      email: string;
      name: string;
    };
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
  }): Promise<void> {
    try {
      const emailOptions: EmailOptions = {
        to: options.to,
        from: options.from || {
          email: env.FROM_EMAIL || 'noreply@velocards.com',
          name: env.FROM_NAME || 'VeloCards'
        },
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.type || att.contentType,
          disposition: att.disposition
        })),
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo
      };

      const result = await unifiedEmailService.sendEmail(emailOptions);

      if (!result.success) {
        throw new AppError('EMAIL_SEND_FAILED', result.error || 'Failed to send email', 500);
      }

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        provider: result.provider,
        emailId: result.id
      });
    } catch (error: any) {
      logger.error('Failed to send email', {
        to: options.to,
        subject: options.subject,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send invoice email to user
   */
  static async sendInvoiceEmail(invoiceId: string): Promise<void> {
    try {
      const ready = await this.isReady();
      if (!ready) {
        logger.warn('Email service not ready, skipping invoice email', { invoiceId });
        return;
      }

      logger.info('Sending invoice email', { invoiceId });

      // Get invoice data
      const emailData = await this.getInvoiceEmailData(invoiceId);
      
      // Generate email template
      const template = this.generateInvoiceEmailTemplate(emailData);
      
      // Prepare attachments
      const attachments: any[] = [];
      
      if (emailData.pdfUrl) {
        try {
          // Download PDF from Supabase storage
          const pdfPath = emailData.pdfUrl.split('/').pop();
          const { data: pdfData, error } = await supabase.storage
            .from('documents')
            .download(`invoices/${pdfPath}`);
          
          if (!error && pdfData) {
            // Convert blob to base64
            const buffer = Buffer.from(await pdfData.arrayBuffer());
            attachments.push({
              filename: `${emailData.invoice.invoice_number}.pdf`,
              content: buffer.toString('base64'),
              contentType: 'application/pdf',
              disposition: 'attachment'
            });
          } else {
            logger.warn('Failed to download PDF for email attachment', { invoiceId, error });
          }
        } catch (err) {
          logger.warn('Error preparing PDF attachment', { invoiceId, error: err });
        }
      }

      // Send email
      const emailOptions: any = {
        to: emailData.user.email,
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent,
        from: {
          email: env.INVOICE_FROM_EMAIL || 'invoices@velocards.com',
          name: env.INVOICE_FROM_NAME || 'VeloCards Finance'
        }
      };

      if (attachments.length > 0) {
        emailOptions.attachments = attachments;
      }

      await this.sendEmail(emailOptions);

      // Log email sent
      await this.logEmailSent(invoiceId, emailData.user.email, template.subject);

      // Update invoice
      await supabase
        .from('invoice_invoices')
        .update({
          email_sent_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      logger.info('Invoice email sent successfully', { 
        invoiceId, 
        email: emailData.user.email,
        invoiceNumber: emailData.invoice.invoice_number
      });
    } catch (error) {
      logger.error('Failed to send invoice email', { invoiceId, error });
      throw new AppError('EMAIL_SEND_FAILED', 'Failed to send invoice email', 500);
    }
  }

  /**
   * Get invoice data for email
   */
  private static async getInvoiceEmailData(invoiceId: string): Promise<any> {
    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoice_invoices')
      .select('id, invoice_number, total_amount, currency, invoice_date, due_date, status, user_id, pdf_url')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    }

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('email, metadata')
      .eq('id', invoice.user_id)
      .single();

    if (userError || !user) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
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
  private static generateInvoiceEmailTemplate(data: any): EmailTemplate {
    const { invoice, user } = data;
    const userName = user.firstName ? `${user.firstName} ${user.lastName}`.trim() : user.email;
    
    const formatCurrency = (amount: number, currency: string = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
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
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                font-size: 14px;
                color: #6b7280;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <div class="company-name">VeloCards</div>
                <div class="invoice-title">Invoice ${invoice.invoice_number}</div>
            </div>
            
            <p>Hello ${userName},</p>
            
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
            <p>This invoice represents your recent activity with VeloCards.</p>
            `}
            
            <div class="footer">
                <p><strong>VeloCards</strong></p>
                <p>Email: support@velocards.com</p>
                <p>This is an automated email. Please do not reply to this message.</p>
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
'This invoice represents your recent activity with VeloCards.'
}

VeloCards
Email: support@velocards.com

This is an automated email. Please do not reply to this message.
    `;

    return {
      subject,
      htmlContent,
      textContent
    };
  }

  /**
   * Log email sent to database
   */
  private static async logEmailSent(invoiceId: string, recipientEmail: string, subject: string): Promise<void> {
    try {
      await supabase
        .from('invoice_email_logs')
        .insert({
          invoice_id: invoiceId,
          recipient_email: recipientEmail,
          subject: subject,
          sent_at: new Date().toISOString(),
          status: 'sent'
        });
    } catch (error) {
      // Log but don't throw - email was sent successfully
      logger.warn('Failed to log email send', { invoiceId, error });
    }
  }

  /**
   * Resend invoice email
   */
  static async resendInvoiceEmail(invoiceId: string, userId: string): Promise<void> {
    // Verify user can access this invoice
    const { data: invoice, error } = await supabase
      .from('invoice_invoices')
      .select('id')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single();

    if (error || !invoice) {
      throw new AppError('NOT_FOUND', 'Invoice not found', 404);
    }

    // Send email
    await this.sendInvoiceEmail(invoiceId);
  }

  /**
   * Send test email (for setup verification)
   */
  static async sendTestEmail(to: string): Promise<void> {
    const ready = await this.isReady();
    if (!ready) {
      throw new AppError('EMAIL_NOT_CONFIGURED', 'Email service not configured', 500);
    }

    await this.sendEmail({
      to,
      subject: 'VeloCards Email Service Test',
      html: `
        <h2>Email Service Test</h2>
        <p>This is a test email to verify that the VeloCards email service is working correctly.</p>
        <p>If you receive this email, the email integration is configured properly.</p>
        <p>Primary Provider: Resend</p>
        <p>Fallback Provider: SendGrid</p>
        <hr>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
      text: `
VeloCards Email Service Test

This is a test email to verify that the VeloCards email service is working correctly.

If you receive this email, the email integration is configured properly.

Primary Provider: Resend
Fallback Provider: SendGrid

Sent at: ${new Date().toISOString()}
      `
    });

    logger.info('Test email sent successfully', { to });
  }

  /**
   * Get email service health status
   */
  static async getHealthStatus() {
    return await unifiedEmailService.getHealthStatus();
  }

  /**
   * Get email service metrics
   */
  static getMetrics() {
    return unifiedEmailService.getMetrics();
  }

  /**
   * Queue an email for delayed sending
   */
  static async queueEmail(
    options: {
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
      attachments?: any[];
      from?: {
        email: string;
        name: string;
      };
    },
    delay?: number
  ): Promise<string> {
    const emailOptions: EmailOptions = {
      to: options.to,
      from: options.from || {
        email: env.FROM_EMAIL || 'noreply@velocards.com',
        name: env.FROM_NAME || 'VeloCards'
      },
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.type || att.contentType,
        disposition: att.disposition
      }))
    };

    return await unifiedEmailService.queueEmail(emailOptions, delay);
  }
}

// Export for backward compatibility
export { unifiedEmailService };
export * from './types';