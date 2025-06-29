import { Worker } from 'bullmq';
export interface WebhookJobData {
    provider: 'admediacards' | 'xmoney';
    event_id: string;
    event_type: string;
    payload: any;
    signature?: string;
    received_at: string;
}
/**
 * Process webhook events asynchronously
 */
export declare const createWebhookWorker: () => Worker<WebhookJobData, any, string>;
//# sourceMappingURL=webhookProcessor.d.ts.map