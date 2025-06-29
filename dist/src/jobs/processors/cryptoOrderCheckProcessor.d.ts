import { Worker } from 'bullmq';
export interface CryptoOrderCheckJobData {
    checkStuckOrders?: boolean;
    cleanupExpiredOrders?: boolean;
    maxPendingHours?: number;
    maxOrderAgeDays?: number;
}
export declare const createCryptoOrderCheckWorker: () => Worker<CryptoOrderCheckJobData, any, string>;
//# sourceMappingURL=cryptoOrderCheckProcessor.d.ts.map