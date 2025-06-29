/**
 * Start all job workers
 */
export declare function startJobWorkers(): Promise<void>;
/**
 * Stop all job workers gracefully
 */
export declare function stopJobWorkers(): Promise<void>;
/**
 * Get worker status
 */
export declare function getWorkerStatus(): {
    name: string;
    isRunning: boolean;
    isPaused: boolean;
    concurrency: number;
}[];
//# sourceMappingURL=index.d.ts.map