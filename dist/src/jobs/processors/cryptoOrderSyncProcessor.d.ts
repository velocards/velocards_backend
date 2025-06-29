import { Worker } from 'bullmq';
export interface CryptoOrderSyncJobData {
    orderId?: string;
    userId?: string;
    fullSync?: boolean;
    maxAge?: number;
}
export declare const createCryptoOrderSyncWorker: () => Worker<CryptoOrderSyncJobData, any, string>;
//# sourceMappingURL=cryptoOrderSyncProcessor.d.ts.map