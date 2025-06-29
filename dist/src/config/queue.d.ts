import { Queue, QueueEvents } from 'bullmq';
export declare const QUEUE_NAMES: {
    readonly TRANSACTION_SYNC: "transaction-sync";
    readonly CARD_SYNC: "card-sync";
    readonly BALANCE_RECONCILIATION: "balance-reconciliation";
    readonly WEBHOOK_PROCESSING: "webhook-processing";
    readonly CRYPTO_ORDER_SYNC: "crypto-order-sync";
    readonly CRYPTO_ORDER_CHECK: "crypto-order-check";
    readonly USER_BALANCE_UPDATE: "user-balance-update";
    readonly SESSION_CLEANUP: "session-cleanup";
    readonly SESSION_MONITORING: "session-monitoring";
    readonly EMAIL_NOTIFICATIONS: "email-notifications";
    readonly DAILY_REPORTS: "daily-reports";
    readonly TIER_UPGRADE: "tier-upgrade";
    readonly MONTHLY_FEE_PROCESSING: "monthly-fee-processing";
    readonly INVOICE_PROCESSING: "invoice-processing";
};
export declare const DEFAULT_JOB_OPTIONS: {
    attempts: number;
    backoff: {
        type: "exponential";
        delay: number;
    };
    removeOnComplete: {
        age: number;
        count: number;
    };
    removeOnFail: {
        age: number;
    };
};
export declare const queues: {
    transactionSync: Queue<any, any, string, any, any, string>;
    cardSync: Queue<any, any, string, any, any, string>;
    balanceReconciliation: Queue<any, any, string, any, any, string>;
    webhookProcessing: Queue<any, any, string, any, any, string>;
    cryptoOrderSync: Queue<any, any, string, any, any, string>;
    cryptoOrderCheck: Queue<any, any, string, any, any, string>;
    userBalanceUpdate: Queue<any, any, string, any, any, string>;
    sessionCleanup: Queue<any, any, string, any, any, string>;
    sessionMonitoring: Queue<any, any, string, any, any, string>;
    emailNotifications: Queue<any, any, string, any, any, string>;
    dailyReports: Queue<any, any, string, any, any, string>;
    tierUpgrade: Queue<any, any, string, any, any, string>;
    monthlyFeeProcessing: Queue<any, any, string, any, any, string>;
    invoiceProcessing: Queue<any, any, string, any, any, string>;
};
export declare const createQueueEvents: (queueName: string) => QueueEvents;
export declare const addRecurringJob: (queue: Queue, jobName: string, data: any, cronPattern: string) => Promise<void>;
export declare const shutdownQueues: () => Promise<void>;
//# sourceMappingURL=queue.d.ts.map