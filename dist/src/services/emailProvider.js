"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailProvider = exports.EmailProviderManager = void 0;
const mail_1 = __importDefault(require("@sendgrid/mail"));
const resend_1 = require("resend");
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
const env_1 = require("../config/env");
/**
 * SendGrid Provider
 */
class SendGridProvider {
    name = 'SendGrid';
    constructor() {
        if (env_1.env.SENDGRID_API_KEY && env_1.env.SENDGRID_API_KEY !== 'mock_sendgrid_key') {
            mail_1.default.setApiKey(env_1.env.SENDGRID_API_KEY);
        }
    }
    isConfigured() {
        return !!env_1.env.SENDGRID_API_KEY && env_1.env.SENDGRID_API_KEY !== 'mock_sendgrid_key';
    }
    async send(options) {
        await mail_1.default.send(options);
    }
}
/**
 * Resend Provider (Alternative to SendGrid)
 */
class ResendProvider {
    name = 'Resend';
    resend = null;
    constructor() {
        const apiKey = env_1.env.RESEND_API_KEY || process.env['RESEND_API_KEY'] || '';
        if (apiKey && apiKey !== '') {
            this.resend = new resend_1.Resend(apiKey);
        }
    }
    isConfigured() {
        return !!this.resend;
    }
    async send(options) {
        if (!this.resend) {
            throw new Error('Resend API key not configured');
        }
        try {
            const emailData = {
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
            logger_1.default.debug('Email sent via Resend', { emailId: data?.id });
        }
        catch (error) {
            logger_1.default.error('Resend send error', error);
            throw error;
        }
    }
}
/**
 * Brevo (formerly Sendinblue) Provider
 */
class BrevoProvider {
    name = 'Brevo';
    apiKey;
    apiUrl = 'https://api.brevo.com/v3/smtp/email';
    constructor() {
        this.apiKey = process.env['BREVO_API_KEY'] || '';
    }
    isConfigured() {
        return !!this.apiKey;
    }
    async send(options) {
        const response = await axios_1.default.post(this.apiUrl, {
            sender: {
                name: options.from.name,
                email: options.from.email
            },
            to: [{ email: options.to }],
            subject: options.subject,
            textContent: options.text,
            htmlContent: options.html,
            attachment: options.attachments
        }, {
            headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json'
            }
        });
        if (response.status !== 201) {
            throw new Error(`Brevo API error: ${response.statusText}`);
        }
    }
}
/**
 * Console Provider (for development/testing)
 */
class ConsoleProvider {
    name = 'Console';
    isConfigured() {
        return true; // Always available
    }
    async send(options) {
        logger_1.default.info('📧 Email (Console Provider):', {
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
class EmailProviderManager {
    providers;
    activeProvider = null;
    constructor() {
        // Initialize providers in order of preference
        this.providers = [
            new ResendProvider(), // Preferred provider
            new SendGridProvider(),
            new BrevoProvider(),
            new ConsoleProvider() // Fallback
        ];
        // Select the first configured provider
        for (const provider of this.providers) {
            if (provider.isConfigured()) {
                this.activeProvider = provider;
                logger_1.default.info(`Email provider configured: ${provider.name}`);
                break;
            }
        }
        if (!this.activeProvider) {
            logger_1.default.warn('No email provider configured, using Console provider');
            this.activeProvider = new ConsoleProvider();
        }
    }
    getActiveProvider() {
        return this.activeProvider?.name || 'None';
    }
    async send(options) {
        if (!this.activeProvider) {
            throw new Error('No email provider configured');
        }
        try {
            await this.activeProvider.send(options);
            logger_1.default.info(`Email sent via ${this.activeProvider.name}`, {
                to: options.to,
                subject: options.subject
            });
        }
        catch (error) {
            logger_1.default.error(`Failed to send email via ${this.activeProvider.name}`, error);
            // Try fallback providers
            for (const provider of this.providers) {
                if (provider !== this.activeProvider && provider.isConfigured()) {
                    try {
                        logger_1.default.info(`Retrying with ${provider.name}`);
                        await provider.send(options);
                        logger_1.default.info(`Email sent via ${provider.name} (fallback)`);
                        return;
                    }
                    catch (fallbackError) {
                        logger_1.default.error(`Failed to send via ${provider.name}`, fallbackError);
                    }
                }
            }
            throw error; // Re-throw if all providers fail
        }
    }
}
exports.EmailProviderManager = EmailProviderManager;
// Export singleton instance
exports.emailProvider = new EmailProviderManager();
//# sourceMappingURL=emailProvider.js.map