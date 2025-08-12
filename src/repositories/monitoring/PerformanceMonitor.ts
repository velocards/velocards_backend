import { performance, PerformanceObserver } from 'perf_hooks'
import logger from '../../utils/logger'
import redis from '../../config/redis'
import { EventEmitter } from 'events'

export interface PerformanceMetric {
  operation: string
  repository: string
  duration: number
  timestamp: Date
  correlationId: string
  status: 'success' | 'error'
  errorMessage?: string
  queryDetails?: {
    filters?: Record<string, unknown>
    limit?: number
    offset?: number
  }
}

export interface PerformanceThresholds {
  warning: number // milliseconds
  critical: number // milliseconds
}

export interface PerformanceStats {
  repository: string
  operation: string
  count: number
  totalDuration: number
  averageDuration: number
  minDuration: number
  maxDuration: number
  p50: number
  p95: number
  p99: number
  errorCount: number
  errorRate: number
  lastUpdated: Date
}

export interface PerformanceAlert {
  level: 'warning' | 'critical'
  repository: string
  operation: string
  duration: number
  threshold: number
  correlationId: string
  timestamp: Date
  message: string
}

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor | null = null
  private metrics: PerformanceMetric[] = []
  private stats: Map<string, PerformanceStats> = new Map()
  private thresholds: Map<string, PerformanceThresholds> = new Map()
  private observer?: PerformanceObserver
  private flushInterval?: NodeJS.Timeout
  private metricsBuffer: PerformanceMetric[] = []
  private readonly maxBufferSize = 1000
  private readonly flushIntervalMs = 60000 // 1 minute
  private readonly maxMetricsInMemory = 10000

  constructor() {
    super()
    this.initializeThresholds()
    this.startFlushInterval()
    this.setupPerformanceObserver()
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  private initializeThresholds(): void {
    // Default thresholds for different operations
    this.thresholds.set('findById', { warning: 50, critical: 200 })
    this.thresholds.set('findAll', { warning: 200, critical: 1000 })
    this.thresholds.set('create', { warning: 100, critical: 500 })
    this.thresholds.set('update', { warning: 100, critical: 500 })
    this.thresholds.set('delete', { warning: 100, critical: 500 })
    this.thresholds.set('query', { warning: 300, critical: 1500 })
    this.thresholds.set('count', { warning: 100, critical: 500 })
    this.thresholds.set('transaction', { warning: 500, critical: 2000 })
  }

  private setupPerformanceObserver(): void {
    this.observer = new PerformanceObserver((items) => {
      items.getEntries().forEach((entry) => {
        if (entry.name.startsWith('repository-')) {
          this.processPerformanceEntry(entry)
        }
      })
    })
    
    this.observer.observe({ entryTypes: ['measure'] })
  }

  private processPerformanceEntry(entry: { name: string; duration: number }): void {
    const parts = entry.name.split('-')
    if (parts.length >= 3) {
      const repository = parts[1]
      const operation = parts[2]
      const correlationId = parts[3] || 'unknown'
      
      this.recordMetric({
        operation: operation || 'unknown',
        repository: repository || 'unknown',
        duration: entry.duration,
        timestamp: new Date(),
        correlationId,
        status: 'success'
      })
    }
  }

  async startOperation(repository: string, operation: string, correlationId: string): Promise<string> {
    const markName = `repository-${repository}-${operation}-${correlationId}-start`
    performance.mark(markName)
    return markName
  }

  async endOperation(
    repository: string,
    operation: string,
    correlationId: string,
    status: 'success' | 'error' = 'success',
    errorMessage?: string,
    queryDetails?: PerformanceMetric['queryDetails']
  ): Promise<void> {
    const startMark = `repository-${repository}-${operation}-${correlationId}-start`
    const endMark = `repository-${repository}-${operation}-${correlationId}-end`
    const measureName = `repository-${repository}-${operation}-${correlationId}`
    
    performance.mark(endMark)
    
    try {
      performance.measure(measureName, startMark, endMark)
      const measure = performance.getEntriesByName(measureName)[0]
      
      if (measure) {
        const metric: PerformanceMetric = {
          operation,
          repository,
          duration: measure.duration,
          timestamp: new Date(),
          correlationId,
          status,
          ...(errorMessage && { errorMessage }),
          ...(queryDetails && { queryDetails })
        }
        
        this.recordMetric(metric)
        
        // Check thresholds and emit alerts
        this.checkThresholds(metric)
      }
    } catch (error) {
      logger.error({
        message: 'Failed to measure performance',
        repository,
        operation,
        error
      })
    } finally {
      // Clean up marks
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
      performance.clearMeasures(measureName)
    }
  }

  private recordMetric(metric: PerformanceMetric): void {
    // Add to buffer
    this.metricsBuffer.push(metric)
    
    // Update in-memory stats
    this.updateStats(metric)
    
    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.maxBufferSize) {
      this.flushMetrics().catch(error => {
        logger.error({
          message: 'Failed to flush metrics',
          error
        })
      })
    }
    
    // Prevent memory overflow
    if (this.metrics.length > this.maxMetricsInMemory) {
      this.metrics = this.metrics.slice(-this.maxMetricsInMemory / 2)
    }
    
    this.metrics.push(metric)
  }

  private updateStats(metric: PerformanceMetric): void {
    const key = `${metric.repository}-${metric.operation}`
    const existing = this.stats.get(key) || this.createEmptyStats(metric.repository, metric.operation)
    
    existing.count++
    existing.totalDuration += metric.duration
    existing.averageDuration = existing.totalDuration / existing.count
    existing.minDuration = Math.min(existing.minDuration, metric.duration)
    existing.maxDuration = Math.max(existing.maxDuration, metric.duration)
    existing.lastUpdated = new Date()
    
    if (metric.status === 'error') {
      existing.errorCount++
    }
    existing.errorRate = existing.errorCount / existing.count
    
    this.stats.set(key, existing)
  }

  private createEmptyStats(repository: string, operation: string): PerformanceStats {
    return {
      repository,
      operation,
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errorCount: 0,
      errorRate: 0,
      lastUpdated: new Date()
    }
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.operation) || 
                     { warning: 1000, critical: 5000 }
    
    if (metric.duration >= threshold.critical) {
      const alert: PerformanceAlert = {
        level: 'critical',
        repository: metric.repository,
        operation: metric.operation,
        duration: metric.duration,
        threshold: threshold.critical,
        correlationId: metric.correlationId,
        timestamp: new Date(),
        message: `Critical: ${metric.repository}.${metric.operation} took ${metric.duration.toFixed(2)}ms (threshold: ${threshold.critical}ms)`
      }
      
      this.emit('alert', alert)
      
      logger.error({
        level: alert.level,
        repository: alert.repository,
        operation: alert.operation,
        duration: alert.duration,
        threshold: alert.threshold,
        correlationId: alert.correlationId,
        timestamp: alert.timestamp,
        message: 'Performance threshold exceeded'
      })
    } else if (metric.duration >= threshold.warning) {
      const alert: PerformanceAlert = {
        level: 'warning',
        repository: metric.repository,
        operation: metric.operation,
        duration: metric.duration,
        threshold: threshold.warning,
        correlationId: metric.correlationId,
        timestamp: new Date(),
        message: `Warning: ${metric.repository}.${metric.operation} took ${metric.duration.toFixed(2)}ms (threshold: ${threshold.warning}ms)`
      }
      
      this.emit('alert', alert)
      
      logger.warn({
        level: alert.level,
        repository: alert.repository,
        operation: alert.operation,
        duration: alert.duration,
        threshold: alert.threshold,
        correlationId: alert.correlationId,
        timestamp: alert.timestamp,
        message: 'Performance warning'
      })
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics().catch(error => {
        logger.error({
          message: 'Failed to flush metrics on interval',
          error
        })
      })
    }, this.flushIntervalMs)
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return
    
    const metricsToFlush = [...this.metricsBuffer]
    this.metricsBuffer = []
    
    try {
      // Store metrics in Redis for persistence
      const pipeline = redis.pipeline()
      
      for (const metric of metricsToFlush) {
        const key = `perf:${metric.repository}:${metric.operation}:${metric.timestamp.getTime()}`
        pipeline.setex(key, 86400, JSON.stringify(metric)) // 24 hour TTL
      }
      
      // Update aggregated stats in Redis
      for (const [key, stats] of this.stats) {
        const statsKey = `perf:stats:${key}`
        pipeline.setex(statsKey, 3600, JSON.stringify(stats)) // 1 hour TTL
      }
      
      await pipeline.exec()
      
      logger.debug({
        message: 'Performance metrics flushed',
        count: metricsToFlush.length,
        statsCount: this.stats.size
      })
    } catch (error) {
      logger.error({
        message: 'Failed to flush metrics to Redis',
        error
      })
      // Re-add metrics to buffer if flush failed
      this.metricsBuffer.unshift(...metricsToFlush)
    }
  }

  getStats(repository?: string, operation?: string): PerformanceStats[] {
    const results: PerformanceStats[] = []
    
    for (const [key, stats] of this.stats) {
      if (repository && !key.startsWith(repository)) continue
      if (operation && !key.endsWith(operation)) continue
      
      // Calculate percentiles from recent metrics
      const relevantMetrics = this.metrics.filter(m => 
        m.repository === stats.repository && 
        m.operation === stats.operation &&
        m.status === 'success'
      ).map(m => m.duration).sort((a, b) => a - b)
      
      if (relevantMetrics.length > 0) {
        stats.p50 = this.calculatePercentile(relevantMetrics, 50)
        stats.p95 = this.calculatePercentile(relevantMetrics, 95)
        stats.p99 = this.calculatePercentile(relevantMetrics, 99)
      }
      
      results.push({ ...stats })
    }
    
    return results
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1
    return sortedValues[Math.max(0, index)] || 0
  }

  async getSlowQueries(limit: number = 10): Promise<PerformanceMetric[]> {
    return this.metrics
      .filter(m => m.status === 'success')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
  }

  async getErroredOperations(limit: number = 10): Promise<PerformanceMetric[]> {
    return this.metrics
      .filter(m => m.status === 'error')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  setThreshold(operation: string, thresholds: PerformanceThresholds): void {
    this.thresholds.set(operation, thresholds)
    
    logger.info({
      message: 'Performance threshold updated',
      operation,
      thresholds
    })
  }

  async detectRegressions(): Promise<Array<{
    repository: string
    operation: string
    regression: number // percentage increase
    previousAvg: number
    currentAvg: number
  }>> {
    const regressions = []
    
    for (const [key, stats] of this.stats) {
      // Get historical average from Redis
      try {
        const historicalKey = `perf:historical:${key}`
        const historicalData = await redis.get(historicalKey)
        
        if (historicalData) {
          const historical = JSON.parse(historicalData) as PerformanceStats
          const regressionPercent = ((stats.averageDuration - historical.averageDuration) / historical.averageDuration) * 100
          
          if (regressionPercent > 20) { // 20% regression threshold
            regressions.push({
              repository: stats.repository,
              operation: stats.operation,
              regression: regressionPercent,
              previousAvg: historical.averageDuration,
              currentAvg: stats.averageDuration
            })
          }
        }
        
        // Update historical data
        await redis.setex(historicalKey, 604800, JSON.stringify(stats)) // 7 day TTL
      } catch (error) {
        logger.error({
          message: 'Failed to detect regression',
          key,
          error
        })
      }
    }
    
    return regressions
  }

  reset(): void {
    this.metrics = []
    this.stats.clear()
    this.metricsBuffer = []
    
    logger.info('Performance monitor reset')
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    
    if (this.observer) {
      this.observer.disconnect()
    }
    
    // Final flush
    await this.flushMetrics()
    
    this.removeAllListeners()
    
    logger.info('Performance monitor shut down')
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance()