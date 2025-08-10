import { performance } from 'perf_hooks';
import logger from '../../../utils/logger';

interface ValidationMetrics {
  schemaName: string;
  duration: number;
  success: boolean;
  errorCount?: number | undefined;
  timestamp: Date;
}

interface AggregatedMetrics {
  totalValidations: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  successRate: number;
  errorRate: number;
}

class ValidationPerformanceMonitor {
  private metrics: ValidationMetrics[] = [];
  private aggregatedMetrics: Map<string, AggregatedMetrics> = new Map();
  private readonly maxMetricsSize = 10000; // Keep last 10k metrics in memory
  private readonly reportInterval = 60000; // Report every 60 seconds

  constructor() {
    // Start periodic reporting
    if (process.env['NODE_ENV'] !== 'test') {
      setInterval(() => this.reportMetrics(), this.reportInterval);
    }
  }

  /**
   * Record validation performance metrics
   */
  recordValidation(
    schemaName: string,
    startTime: number,
    success: boolean,
    errorCount?: number
  ): void {
    const duration = performance.now() - startTime;
    
    const metric: ValidationMetrics = {
      schemaName,
      duration,
      success,
      errorCount,
      timestamp: new Date()
    };

    // Add to metrics array
    this.metrics.push(metric);
    
    // Trim metrics if too large
    if (this.metrics.length > this.maxMetricsSize) {
      this.metrics = this.metrics.slice(-this.maxMetricsSize);
    }

    // Update aggregated metrics
    this.updateAggregatedMetrics(schemaName, metric);

    // Log slow validations
    if (duration > 100) { // Log if validation takes more than 100ms
      logger.warn('Slow validation detected', {
        schemaName,
        duration: `${duration.toFixed(2)}ms`,
        success,
        errorCount
      });
    }
  }

  /**
   * Update aggregated metrics for a schema
   */
  private updateAggregatedMetrics(schemaName: string, metric: ValidationMetrics): void {
    const current = this.aggregatedMetrics.get(schemaName) || {
      totalValidations: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: Infinity,
      successRate: 0,
      errorRate: 0
    };

    const newTotal = current.totalValidations + 1;
    const newAverage = 
      (current.averageDuration * current.totalValidations + metric.duration) / newTotal;

    this.aggregatedMetrics.set(schemaName, {
      totalValidations: newTotal,
      averageDuration: newAverage,
      maxDuration: Math.max(current.maxDuration, metric.duration),
      minDuration: Math.min(current.minDuration, metric.duration),
      successRate: metric.success 
        ? (current.successRate * current.totalValidations + 1) / newTotal
        : (current.successRate * current.totalValidations) / newTotal,
      errorRate: 1 - ((current.successRate * current.totalValidations + (metric.success ? 1 : 0)) / newTotal)
    });
  }

  /**
   * Get performance metrics for a specific schema
   */
  getMetrics(schemaName?: string): ValidationMetrics[] | AggregatedMetrics | null {
    if (schemaName) {
      return this.aggregatedMetrics.get(schemaName) || null;
    }
    return this.metrics;
  }

  /**
   * Get all aggregated metrics
   */
  getAllAggregatedMetrics(): Map<string, AggregatedMetrics> {
    return this.aggregatedMetrics;
  }

  /**
   * Report metrics to logger
   */
  private reportMetrics(): void {
    const report: any = {
      timestamp: new Date().toISOString(),
      totalValidations: this.metrics.length,
      schemas: {}
    };

    this.aggregatedMetrics.forEach((metrics, schemaName) => {
      report.schemas[schemaName] = {
        totalValidations: metrics.totalValidations,
        averageDuration: `${metrics.averageDuration.toFixed(2)}ms`,
        maxDuration: `${metrics.maxDuration.toFixed(2)}ms`,
        minDuration: metrics.minDuration === Infinity ? '0ms' : `${metrics.minDuration.toFixed(2)}ms`,
        successRate: `${(metrics.successRate * 100).toFixed(2)}%`,
        errorRate: `${(metrics.errorRate * 100).toFixed(2)}%`
      };
    });

    logger.info('Validation Performance Report', report);
  }

  /**
   * Create benchmark for common validation scenarios
   */
  async benchmark(
    schemaName: string,
    schema: any,
    testData: any[]
  ): Promise<{ averageTime: number; successRate: number }> {
    const results: { time: number; success: boolean }[] = [];

    for (const data of testData) {
      const startTime = performance.now();
      let success = false;
      
      try {
        await schema.parseAsync(data);
        success = true;
      } catch {
        success = false;
      }
      
      const endTime = performance.now();
      results.push({ time: endTime - startTime, success });
    }

    const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
    const successRate = results.filter(r => r.success).length / results.length;

    logger.info(`Benchmark results for ${schemaName}`, {
      averageTime: `${averageTime.toFixed(2)}ms`,
      successRate: `${(successRate * 100).toFixed(2)}%`,
      samples: testData.length
    });

    return { averageTime, successRate };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.aggregatedMetrics.clear();
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): {
    raw: ValidationMetrics[];
    aggregated: Record<string, AggregatedMetrics>;
  } {
    const aggregated: Record<string, AggregatedMetrics> = {};
    this.aggregatedMetrics.forEach((value, key) => {
      aggregated[key] = value;
    });

    return {
      raw: [...this.metrics],
      aggregated
    };
  }
}

// Export singleton instance
export const validationMonitor = new ValidationPerformanceMonitor();

// Export types
export type { ValidationMetrics, AggregatedMetrics };