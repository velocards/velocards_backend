import { Worker, Job } from 'bullmq';
interface SessionCleanupJobData {
    cleanupExpiredSessions: boolean;
    cleanupInactiveSessions: boolean;
    maxInactiveHours?: number;
}
/**
 * Process session cleanup jobs
 */
export declare const processSessionCleanup: (job: Job<SessionCleanupJobData>) => Promise<{
    success: boolean;
    reason: string;
    cleanedCount: number;
    expiredSessions?: never;
    inactiveSessions?: never;
} | {
    success: boolean;
    cleanedCount: number;
    expiredSessions: boolean;
    inactiveSessions: boolean;
    reason?: never;
}>;
/**
 * Create and export session cleanup worker
 */
export declare function createSessionCleanupWorker(): Worker;
export {};
//# sourceMappingURL=sessionCleanupProcessor.d.ts.map