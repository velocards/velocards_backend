import { Worker } from 'bullmq';
export interface TierUpgradeJobData {
    userId?: string;
    reason?: string;
}
/**
 * Process tier upgrades based on spending and KYC status
 */
export declare const createTierUpgradeWorker: () => Worker<TierUpgradeJobData, any, string>;
/**
 * Schedule daily tier checks
 */
export declare const scheduleTierUpgrades: () => Promise<void>;
//# sourceMappingURL=tierUpgradeProcessor.d.ts.map