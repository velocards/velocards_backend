import sgMail from '@sendgrid/mail';
import { Resend } from 'resend';
import axios from 'axios';
import logger from '../utils/logger';
import { env } from '../config/env';

interface EmailOptions {
  to: string;
  from: {
    email: string;
    name: string;
  };
  subject: string;
  text: string;
  html: string;
  attachments?: any[];
}

interface EmailProvider {
  name: string;
  send(options: EmailOptions): Promise<void>;
  isConfigured(): boolean;
}

/**
 * SendGrid Provider
 */
class SendGridProvider implements EmailProvider {
  name = 'SendGrid';

  constructor() {
    if (env.SENDGRID_API_KEY && env.SENDGRID_API_KEY !== 'mock_sendgrid_key') {
      sgMail.setApiKey(env.SENDGRID_API_KEY);
    }
  }

  isConfigured(): boolean {
    return !!env.SENDGRID_API_KEY && env.SENDGRID_API_KEY !== 'mock_sendgrid_key';
  }

  async send(options: EmailOptions): Promise<void> {
    await sgMail.send(options);
  }
}

/**
 * Resend Provider (Alternative to SendGrid)
 */
class ResendProvider implements EmailProvider {
  name = 'Resend';
  private resend: Resend | null = null;

  constructor() {
    const apiKey = env.RESEND_API_KEY || process.env['RESEND_API_KEY'] || '';
    if (apiKey && apiKey !== '') {
      this.resend = new Resend(apiKey);
    }
  }

  isConfigured(): boolean {
    return !!this.resend;
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.resend) {
      throw new Error('Resend API key not configured');
    }

    try {
      const emailData: any = {
        from: `${options.from.name} <${options.from.email}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      if (options.attachments && options.attachments.length > 0) {
        emailData.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          content_type: att.type || 'application/octet-stream'
        }));
      }

      const { data, error } = await this.resend.emails.send(emailData);

      if (error) {
        throw new Error(`Resend API error: ${error.message}`);
      }

      logger.debug('Email sent via Resend', { emailId: data?.id });
    } catch (error) {
      logger.error('Resend send error', error);
      throw error;
    }
  }
}

/**
 * Brevo (formerly Sendinblue) Provider
 */
class BrevoProvider implements EmailProvider {
  name = 'Brevo';
  private apiKey: string;
  private apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor() {
    this.apiKey = process.env['BREVO_API_KEY'] || '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(options: EmailOptions): Promise<void> {
    const response = await axios.post(
      this.apiUrl,
      {
        sender: {
          name: options.from.name,
          email: options.from.email
        },
        to: [{ email: options.to }],
        subject: options.subject,
        textContent: options.text,
        htmlContent: options.html,
        attachment: options.attachments
      },
      {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status !== 201) {
      throw new Error(`Brevo API error: ${response.statusText}`);
    }
  }
}

/**
 * Console Provider (for development/testing)
 */
class ConsoleProvider implements EmailProvider {
  name = 'Console';

  isConfigured(): boolean {
    return true; // Always available
  }

  async send(options: EmailOptions): Promise<void> {
    logger.info('📧 Email (Console Provider):', {
      to: options.to,
      from: options.from,
      subject: options.subject,
      preview: options.text.substring(0, 100) + '...'
    });
  }
}

/**
 * Email Provider Manager
 * Automatically selects the first configured provider
 */
export class EmailProviderManager {
  private providers: EmailProvider[];
  private activeProvider: EmailProvider | null = null;

  constructor() {
    // Initialize providers in order of preference
    this.providers = [
      new ResendProvider(),    // Preferred provider
      new SendGridProvider(),
      new BrevoProvider(),
      new ConsoleProvider()    // Fallback
    ];

    // Select the first configured provider
    for (const provider of this.providers) {
      if (provider.isConfigured()) {
        this.activeProvider = provider;
        logger.info(`Email provider configured: ${provider.name}`);
        break;
      }
    }

    if (!this.activeProvider) {
      logger.warn('No email provider configured, using Console provider');
      this.activeProvider = new ConsoleProvider();
    }
  }

  getActiveProvider(): string {
    return this.activeProvider?.name || 'None';
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.activeProvider) {
      throw new Error('No email provider configured');
    }

    try {
      await this.activeProvider.send(options);
      logger.info(`Email sent via ${this.activeProvider.name}`, {
        to: options.to,
        subject: options.subject
      });
    } catch (error) {
      logger.error(`Failed to send email via ${this.activeProvider.name}`, error);
      
      // Try fallback providers
      for (const provider of this.providers) {
        if (provider !== this.activeProvider && provider.isConfigured()) {
          try {
            logger.info(`Retrying with ${provider.name}`);
            await provider.send(options);
            logger.info(`Email sent via ${provider.name} (fallback)`);
            return;
          } catch (fallbackError) {
            logger.error(`Failed to send via ${provider.name}`, fallbackError);
          }
        }
      }
      
      throw error; // Re-throw if all providers fail
    }
  }
}

// Export singleton instance
export const emailProvider = new EmailProviderManager();