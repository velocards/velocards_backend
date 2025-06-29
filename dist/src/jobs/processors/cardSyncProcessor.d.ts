import { Worker } from 'bullmq';
export interface CardSyncJobData {
    userId?: string;
    cardId?: string;
    fullSync?: boolean;
}
/**
 * Process card sync jobs
 * Updates card details from Admediacards API
 */
export declare const createCardSyncWorker: () => Worker<CardSyncJobData, any, string>;
//# sourceMappingURL=cardSyncProcessor.d.ts.map