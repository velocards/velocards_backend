import { Worker, Job } from 'bullmq';
interface SessionMonitoringJobData {
    generateReport: boolean;
    checkSuspiciousActivity: boolean;
    alertThresholds?: {
        maxConcurrentSessions?: number;
        maxFailedLogins?: number;
        timeWindowMinutes?: number;
    };
}
/**
 * Process session monitoring jobs
 */
export declare const processSessionMonitoring: (job: Job<SessionMonitoringJobData>) => Promise<any>;
/**
 * Create and export session monitoring worker
 */
export declare function createSessionMonitoringWorker(): Worker;
export {};
//# sourceMappingURL=sessionMonitoringProcessor.d.ts.map