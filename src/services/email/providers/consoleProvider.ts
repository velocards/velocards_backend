import { EmailProvider, EmailOptions, EmailResult } from '../types';
import logger from '../../../utils/logger';

/**
 * Console Email Provider
 * Development/testing provider that logs emails to console
 */
export class ConsoleProvider implements EmailProvider {
  public readonly name = 'Console';

  isConfigured(): boolean {
    return true; // Always available for development
  }

  async isHealthy(): Promise<boolean> {
    return true; // Always healthy
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const emailId = `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info('📧 Email (Console Provider)', {
      id: emailId,
      to: options.to,
      from: options.from,
      subject: options.subject,
      textPreview: options.text?.substring(0, 100),
      hasHtml: !!options.html,
      attachments: options.attachments?.length || 0,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      tags: options.tags
    });

    // In development, also log the full content if debug is enabled
    if (process.env['NODE_ENV'] === 'development' && process.env['ENABLE_DEBUG_LOGS'] === 'true') {
      logger.debug('Email full content', {
        id: emailId,
        text: options.text,
        html: options.html?.substring(0, 500) // Limit HTML for readability
      });
    }

    return {
      id: emailId,
      provider: this.name,
      timestamp: new Date(),
      success: true
    };
  }
}