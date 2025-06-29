import { Worker } from 'bullmq';
export interface TransactionSyncJobData {
    userId?: string;
    cardId?: string;
    startDate?: string;
    endDate?: string;
    fullSync?: boolean;
}
/**
 * Process transaction sync jobs
 * Syncs transactions from Admediacards to our database
 */
export declare const createTransactionSyncWorker: () => Worker<TransactionSyncJobData, any, string>;
//# sourceMappingURL=transactionSyncProcessor.d.ts.map