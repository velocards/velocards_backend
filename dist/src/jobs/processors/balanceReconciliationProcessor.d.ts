import { Worker } from 'bullmq';
export interface BalanceReconciliationJobData {
    type: 'master_account' | 'user_balances' | 'full';
}
/**
 * Process balance reconciliation jobs
 * Ensures our balance records match actual balances
 */
export declare const createBalanceReconciliationWorker: () => Worker<BalanceReconciliationJobData, any, string>;
//# sourceMappingURL=balanceReconciliationProcessor.d.ts.map