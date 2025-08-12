import { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../config/database'
import logger from '../../utils/logger'
import { performance } from 'perf_hooks'

export interface PoolConfig {
  maxConnections: number
  minConnections: number
  connectionTimeout: number
  idleTimeout: number
  maxRetries: number
  retryDelay: number
  enableHealthChecks: boolean
  healthCheckInterval: number
}

export interface PoolMetrics {
  activeConnections: number
  idleConnections: number
  totalConnections: number
  waitingRequests: number
  averageWaitTime: number
  connectionErrors: number
  healthCheckStatus: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  requestsServed: number
  averageResponseTime: number
}

export interface ConnectionHealth {
  isHealthy: boolean
  lastCheckTime: Date
  consecutiveFailures: number
  latency: number
}

export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager | null = null
  private pools: Map<string, SupabaseClient[]> = new Map()
  private activeConnections: Map<string, Set<SupabaseClient>> = new Map()
  private metrics: Map<string, PoolMetrics> = new Map()
  private health: Map<string, ConnectionHealth> = new Map()
  private config: PoolConfig
  private startTime: number
  private healthCheckInterval?: NodeJS.Timeout

  constructor(config?: Partial<PoolConfig>) {
    this.config = {
      maxConnections: 20,
      minConnections: 5,
      connectionTimeout: 30000,
      idleTimeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      enableHealthChecks: true,
      healthCheckInterval: 30000,
      ...config
    }
    
    this.startTime = Date.now()
    this.initializePools()
    
    if (this.config.enableHealthChecks) {
      this.startHealthChecks()
    }
  }

  static getInstance(config?: Partial<PoolConfig>): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager(config)
    }
    return ConnectionPoolManager.instance
  }

  private initializePools(): void {
    // Initialize default pool
    this.createPool('default', this.config.minConnections)
    
    // Initialize specialized pools for high-traffic operations
    this.createPool('read', Math.floor(this.config.maxConnections * 0.6))
    this.createPool('write', Math.floor(this.config.maxConnections * 0.3))
    this.createPool('transaction', Math.floor(this.config.maxConnections * 0.1))
    
    logger.info({
      message: 'Connection pools initialized',
      pools: Array.from(this.pools.keys()),
      config: this.config
    })
  }

  private createPool(poolName: string, size: number): void {
    const connections: SupabaseClient[] = []
    
    for (let i = 0; i < size; i++) {
      // In production, each connection would be a separate instance
      // For Supabase, we're using the singleton but tracking usage
      connections.push(supabase)
    }
    
    this.pools.set(poolName, connections)
    this.activeConnections.set(poolName, new Set())
    this.metrics.set(poolName, this.createEmptyMetrics())
    this.health.set(poolName, {
      isHealthy: true,
      lastCheckTime: new Date(),
      consecutiveFailures: 0,
      latency: 0
    })
  }

  private createEmptyMetrics(): PoolMetrics {
    return {
      activeConnections: 0,
      idleConnections: this.config.minConnections,
      totalConnections: this.config.minConnections,
      waitingRequests: 0,
      averageWaitTime: 0,
      connectionErrors: 0,
      healthCheckStatus: 'healthy',
      uptime: 0,
      requestsServed: 0,
      averageResponseTime: 0
    }
  }

  async getConnection(poolName: string = 'default'): Promise<SupabaseClient> {
    const startTime = performance.now()
    const pool = this.pools.get(poolName)
    const active = this.activeConnections.get(poolName)
    const metrics = this.metrics.get(poolName)
    
    if (!pool || !active || !metrics) {
      throw new Error(`Pool ${poolName} not found`)
    }
    
    // Find available connection
    let connection: SupabaseClient | undefined
    let attempts = 0
    
    while (!connection && attempts < this.config.maxRetries) {
      for (const conn of pool) {
        if (!active.has(conn)) {
          connection = conn
          break
        }
      }
      
      if (!connection) {
        // All connections busy, wait and retry
        metrics.waitingRequests++
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
        attempts++
      }
    }
    
    if (!connection) {
      metrics.connectionErrors++
      throw new Error(`No available connections in pool ${poolName}`)
    }
    
    // Mark connection as active
    active.add(connection)
    metrics.activeConnections = active.size
    metrics.idleConnections = pool.length - active.size
    metrics.requestsServed++
    
    // Update wait time metrics
    const waitTime = performance.now() - startTime
    metrics.averageWaitTime = (metrics.averageWaitTime * (metrics.requestsServed - 1) + waitTime) / metrics.requestsServed
    
    logger.debug({
      message: 'Connection acquired',
      poolName,
      activeConnections: metrics.activeConnections,
      waitTime
    })
    
    return connection
  }

  releaseConnection(connection: SupabaseClient, poolName: string = 'default'): void {
    const active = this.activeConnections.get(poolName)
    const metrics = this.metrics.get(poolName)
    
    if (!active || !metrics) {
      return
    }
    
    if (active.has(connection)) {
      active.delete(connection)
      metrics.activeConnections = active.size
      metrics.idleConnections = (this.pools.get(poolName)?.length || 0) - active.size
      
      logger.debug({
        message: 'Connection released',
        poolName,
        activeConnections: metrics.activeConnections
      })
    }
  }

  async executeWithConnection<T>(
    operation: (client: SupabaseClient) => Promise<T>,
    poolName: string = 'default'
  ): Promise<T> {
    const startTime = performance.now()
    const connection = await this.getConnection(poolName)
    const metrics = this.metrics.get(poolName)
    
    try {
      const result = await operation(connection)
      
      if (metrics) {
        const responseTime = performance.now() - startTime
        metrics.averageResponseTime = 
          (metrics.averageResponseTime * (metrics.requestsServed - 1) + responseTime) / metrics.requestsServed
      }
      
      return result
    } catch (error) {
      if (metrics) {
        metrics.connectionErrors++
      }
      throw error
    } finally {
      this.releaseConnection(connection, poolName)
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      this.config.healthCheckInterval
    )
  }

  private async performHealthChecks(): Promise<void> {
    for (const [poolName, pool] of this.pools) {
      const health = this.health.get(poolName)
      const metrics = this.metrics.get(poolName)
      
      if (!health || !metrics) continue
      
      try {
        const startTime = performance.now()
        
        // Test a connection from the pool
        const testConnection = pool[0]
        if (!testConnection) {
          throw new Error('No connection available in pool')
        }
        const { error } = await testConnection
          .from('users')
          .select('id')
          .limit(1)
        
        const latency = performance.now() - startTime
        
        if (error) {
          health.consecutiveFailures++
          health.isHealthy = false
        } else {
          health.consecutiveFailures = 0
          health.isHealthy = true
          health.latency = latency
        }
        
        health.lastCheckTime = new Date()
        
        // Update health status
        if (health.consecutiveFailures === 0) {
          metrics.healthCheckStatus = 'healthy'
        } else if (health.consecutiveFailures < 3) {
          metrics.healthCheckStatus = 'degraded'
        } else {
          metrics.healthCheckStatus = 'unhealthy'
        }
        
        // Update uptime
        metrics.uptime = Date.now() - this.startTime
        
      } catch (error) {
        logger.error({
          message: 'Health check failed',
          poolName,
          error
        })
        
        if (health) {
          health.consecutiveFailures++
          health.isHealthy = false
        }
      }
    }
  }

  async optimizePool(poolName: string): Promise<void> {
    const metrics = this.metrics.get(poolName)
    const pool = this.pools.get(poolName)
    
    if (!metrics || !pool) return
    
    // Calculate optimal pool size based on metrics
    const utilizationRate = metrics.activeConnections / pool.length
    const errorRate = metrics.connectionErrors / Math.max(metrics.requestsServed, 1)
    
    if (utilizationRate > 0.8 && pool.length < this.config.maxConnections) {
      // High utilization, increase pool size
      const newSize = Math.min(pool.length + 2, this.config.maxConnections)
      this.resizePool(poolName, newSize)
      
      logger.info({
        message: 'Pool size increased',
        poolName,
        oldSize: pool.length,
        newSize,
        utilizationRate
      })
    } else if (utilizationRate < 0.2 && pool.length > this.config.minConnections) {
      // Low utilization, decrease pool size
      const newSize = Math.max(pool.length - 1, this.config.minConnections)
      this.resizePool(poolName, newSize)
      
      logger.info({
        message: 'Pool size decreased',
        poolName,
        oldSize: pool.length,
        newSize,
        utilizationRate
      })
    }
    
    // Log optimization metrics
    if (errorRate > 0.05) {
      logger.warn({
        message: 'High error rate detected',
        poolName,
        errorRate,
        connectionErrors: metrics.connectionErrors,
        requestsServed: metrics.requestsServed
      })
    }
  }

  private resizePool(poolName: string, newSize: number): void {
    const pool = this.pools.get(poolName)
    if (!pool) return
    
    const currentSize = pool.length
    
    if (newSize > currentSize) {
      // Add connections
      for (let i = currentSize; i < newSize; i++) {
        pool.push(supabase)
      }
    } else if (newSize < currentSize) {
      // Remove idle connections
      const active = this.activeConnections.get(poolName)
      if (!active) return
      
      const toRemove: SupabaseClient[] = []
      for (const conn of pool) {
        if (!active.has(conn) && toRemove.length < (currentSize - newSize)) {
          toRemove.push(conn)
        }
      }
      
      for (const conn of toRemove) {
        const index = pool.indexOf(conn)
        if (index > -1) {
          pool.splice(index, 1)
        }
      }
    }
    
    // Update metrics
    const metrics = this.metrics.get(poolName)
    if (metrics) {
      metrics.totalConnections = pool.length
      metrics.idleConnections = pool.length - (this.activeConnections.get(poolName)?.size || 0)
    }
  }

  getMetrics(poolName?: string): PoolMetrics | Map<string, PoolMetrics> {
    if (poolName) {
      return this.metrics.get(poolName) || this.createEmptyMetrics()
    }
    return new Map(this.metrics)
  }

  getHealth(poolName?: string): ConnectionHealth | Map<string, ConnectionHealth> | undefined {
    if (poolName) {
      return this.health.get(poolName)
    }
    return new Map(this.health)
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    
    // Wait for all active connections to be released
    const maxWaitTime = 10000 // 10 seconds
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitTime) {
      let hasActiveConnections = false
      
      for (const [poolName, active] of this.activeConnections) {
        if (active.size > 0) {
          hasActiveConnections = true
          logger.info({
            message: 'Waiting for active connections',
            poolName,
            activeCount: active.size
          })
        }
      }
      
      if (!hasActiveConnections) {
        break
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Clear all pools
    this.pools.clear()
    this.activeConnections.clear()
    this.metrics.clear()
    this.health.clear()
    
    logger.info('Connection pool manager shut down')
  }
}

// Export singleton instance
export const connectionPoolManager = ConnectionPoolManager.getInstance()