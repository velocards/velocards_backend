/**
 * Initialize all recurring jobs
 */
export declare function initializeScheduledJobs(): Promise<void>;
/**
 * Clean up old recurring jobs (useful when changing schedules)
 */
export declare function cleanupOldJobs(): Promise<void>;
/**
 * Get status of all recurring jobs
 */
export declare function getRecurringJobsStatus(): Promise<Record<string, any[]>>;
//# sourceMappingURL=jobScheduler.d.ts.map