/**
 * Email Service Types
 * Defines interfaces and types for the unified email service
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  disposition?: 'attachment' | 'inline';
}

export interface EmailOptions {
  to: string | string[];
  from: EmailAddress;
  subject: string;
  text?: string | undefined;
  html?: string | undefined;
  attachments?: EmailAttachment[] | undefined;
  replyTo?: string | undefined;
  cc?: string | string[] | undefined;
  bcc?: string | string[] | undefined;
  headers?: Record<string, string> | undefined;
  tags?: string[] | undefined;
}

export interface EmailResult {
  id?: string | undefined;
  provider: string;
  timestamp: Date;
  success: boolean;
  error?: string | undefined;
}

export interface EmailProvider {
  name: string;
  isConfigured(): boolean;
  isHealthy(): Promise<boolean>;
  send(options: EmailOptions): Promise<EmailResult>;
}

export interface EmailProviderConfig {
  priority: number;
  enabled: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface EmailServiceConfig {
  providers: Map<string, EmailProviderConfig>;
  fallbackEnabled: boolean;
  retryDelayMs: number;
  maxRetries: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface EmailMetrics {
  provider: string;
  sent: number;
  failed: number;
  lastSuccess?: Date;
  lastFailure?: Date;
  averageResponseTime?: number;
}

export enum EmailProviderType {
  RESEND = 'resend',
  SENDGRID = 'sendgrid',
  CONSOLE = 'console'
}

export interface EmailDeliveryStatus {
  emailId: string;
  provider: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  timestamp: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface EmailQueueItem {
  id: string;
  options: EmailOptions;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  nextRetryAt?: Date | undefined;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string | undefined;
}