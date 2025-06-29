import { Worker } from 'bullmq';
export interface UserBalanceUpdateJobData {
    userId: string;
    amount: number;
    type: 'credit' | 'debit';
    reason: 'crypto_deposit_completed' | 'card_funding' | 'refund' | 'fee' | 'adjustment' | 'withdrawal';
    referenceType?: string;
    referenceId?: string;
    description?: string;
    cryptoTransactionId?: string;
    cardId?: string;
    metadata?: Record<string, any>;
}
export declare const createUserBalanceUpdateWorker: () => Worker<UserBalanceUpdateJobData, any, string>;
//# sourceMappingURL=userBalanceUpdateProcessor.d.ts.map