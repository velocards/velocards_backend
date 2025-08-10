import sgMail from '@sendgrid/mail';
import { EmailProvider, EmailOptions, EmailResult } from '../types';
import logger from '../../../utils/logger';
import { env } from '../../../config/env';

/**
 * SendGrid Email Provider
 * Fallback email provider using SendGrid API
 */
export class SendGridProvider implements EmailProvider {
  public readonly name = 'SendGrid';
  private isInitialized = false;
  private failureCount = 0;
  private lastFailureTime: Date | undefined;
  private readonly maxConsecutiveFailures = 3;
  private readonly healthCheckResetMs = 60000; // Reset failure count after 1 minute

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = env.SENDGRID_API_KEY;
    
    if (apiKey && apiKey !== '' && apiKey !== 'mock_sendgrid_key') {
      sgMail.setApiKey(apiKey);
      this.isInitialized = true;
      logger.info('SendGrid provider initialized');
    } else {
      logger.warn('SendGrid API key not configured');
    }
  }

  isConfigured(): boolean {
    return this.isInitialized;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    // Reset failure count if enough time has passed
    if (this.lastFailureTime && 
        Date.now() - this.lastFailureTime.getTime() > this.healthCheckResetMs) {
      this.failureCount = 0;
      this.lastFailureTime = undefined;
    }

    // Consider unhealthy if too many consecutive failures
    if (this.failureCount >= this.maxConsecutiveFailures) {
      return false;
    }

    return true;
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.isInitialized) {
      throw new Error('SendGrid provider not configured');
    }

    const startTime = Date.now();

    try {
      // Prepare email data for SendGrid API
      const emailData: any = {
        to: options.to,
        from: {
          email: options.from.email,
          name: options.from.name || 'VeloCards'
        },
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        headers: options.headers,
        categories: options.tags // SendGrid uses 'categories' instead of 'tags'
      };

      // Handle attachments
      if (options.attachments && options.attachments.length > 0) {
        emailData.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          type: att.contentType || 'application/octet-stream',
          disposition: att.disposition || 'attachment'
        }));
      }

      // Remove undefined fields
      Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined) {
          delete emailData[key];
        }
      });

      // Send email via SendGrid
      const [response] = await sgMail.send(emailData);

      // Reset failure count on success
      this.failureCount = 0;
      this.lastFailureTime = undefined;

      const responseTime = Date.now() - startTime;
      
      logger.info('Email sent via SendGrid', {
        messageId: response.headers['x-message-id'],
        to: options.to,
        subject: options.subject,
        responseTime
      });

      return {
        id: response.headers['x-message-id'],
        provider: this.name,
        timestamp: new Date(),
        success: true
      };

    } catch (error: any) {
      // Increment failure count
      this.failureCount++;
      this.lastFailureTime = new Date();

      const responseTime = Date.now() - startTime;
      
      // Extract error details from SendGrid error
      let errorMessage = 'Failed to send email via SendGrid';
      if (error.response?.body?.errors?.[0]?.message) {
        errorMessage = error.response.body.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      logger.error('SendGrid provider error', {
        error: errorMessage,
        code: error.code,
        to: options.to,
        subject: options.subject,
        failureCount: this.failureCount,
        responseTime
      });

      return {
        provider: this.name,
        timestamp: new Date(),
        success: false,
        error: errorMessage
      };
    }
  }
}