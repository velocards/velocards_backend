import { Resend } from 'resend';
import { EmailProvider, EmailOptions, EmailResult } from '../types';
import logger from '../../../utils/logger';
import { env } from '../../../config/env';

/**
 * Resend Email Provider
 * Primary email provider using Resend API
 */
export class ResendProvider implements EmailProvider {
  public readonly name = 'Resend';
  private client: Resend | null = null;
  private failureCount = 0;
  private lastFailureTime: Date | undefined;
  private readonly maxConsecutiveFailures = 3;
  private readonly healthCheckResetMs = 60000; // Reset failure count after 1 minute

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = env.RESEND_API_KEY;
    
    if (apiKey && apiKey !== '' && apiKey !== 'mock_resend_key') {
      this.client = new Resend(apiKey);
      logger.info('Resend provider initialized');
    } else {
      logger.warn('Resend API key not configured');
    }
  }

  isConfigured(): boolean {
    return !!this.client;
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
    if (!this.client) {
      throw new Error('Resend provider not configured');
    }

    const startTime = Date.now();

    try {
      // Prepare email data for Resend API
      const emailData: any = {
        from: `${options.from.name || 'VeloCards'} <${options.from.email}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html,
        reply_to: options.replyTo,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
        headers: options.headers,
        tags: options.tags
      };

      // Handle attachments
      if (options.attachments && options.attachments.length > 0) {
        emailData.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          content_type: att.contentType || 'application/octet-stream'
        }));
      }

      // Remove undefined fields
      Object.keys(emailData).forEach(key => {
        if (emailData[key] === undefined) {
          delete emailData[key];
        }
      });

      // Send email via Resend
      const response = await this.client.emails.send(emailData);

      // Handle response
      if (response.error) {
        throw new Error(response.error.message);
      }

      // Reset failure count on success
      this.failureCount = 0;
      this.lastFailureTime = undefined;

      const responseTime = Date.now() - startTime;
      
      logger.info('Email sent via Resend', {
        emailId: response.data?.id,
        to: options.to,
        subject: options.subject,
        responseTime
      });

      return {
        id: response.data?.id || undefined,
        provider: this.name,
        timestamp: new Date(),
        success: true
      };

    } catch (error: any) {
      // Increment failure count
      this.failureCount++;
      this.lastFailureTime = new Date();

      const responseTime = Date.now() - startTime;
      
      logger.error('Resend provider error', {
        error: error.message,
        to: options.to,
        subject: options.subject,
        failureCount: this.failureCount,
        responseTime
      });

      return {
        provider: this.name,
        timestamp: new Date(),
        success: false,
        error: error.message || 'Failed to send email via Resend'
      };
    }
  }
}