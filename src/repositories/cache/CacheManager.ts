import Redis from 'ioredis'
import redis from '../../config/redis'
import logger from '../../utils/logger'
import { createHash } from 'crypto'

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
  invalidateOnWrite?: boolean
  namespace?: string
}

export interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  lastReset: Date
}

export class CacheManager {
  private redis: Redis
  private metrics: Map<string, CacheMetrics> = new Map()
  private defaultTTL: number = 300 // 5 minutes default
  private readonly cachePrefix: string = 'repo:cache:'

  constructor(redisClient?: Redis) {
    this.redis = redisClient || redis
    this.initializeMetrics()
  }

  private initializeMetrics(): void {
    // Reset metrics every hour
    setInterval(() => {
      this.metrics.clear()
    }, 3600000)
  }

  private generateKey(namespace: string, identifier: string, params?: Record<string, unknown>): string {
    const baseKey = `${this.cachePrefix}${namespace}:${identifier}`
    
    if (!params || Object.keys(params).length === 0) {
      return baseKey
    }

    // Create deterministic hash of params for cache key
    const paramHash = createHash('md5')
      .update(JSON.stringify(this.sortObject(params)))
      .digest('hex')
      .substring(0, 8)
    
    return `${baseKey}:${paramHash}`
  }

  private sortObject(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = obj[key]
        return sorted
      }, {} as Record<string, unknown>)
  }

  async get<T>(
    namespace: string,
    identifier: string,
    params?: Record<string, unknown>
  ): Promise<T | null> {
    const key = this.generateKey(namespace, identifier, params)
    
    try {
      const cached = await this.redis.get(key)
      
      if (cached) {
        this.recordHit(namespace)
        logger.debug({
          message: 'Cache hit',
          key,
          namespace,
          correlationId: identifier
        })
        return JSON.parse(cached) as T
      }
      
      this.recordMiss(namespace)
      logger.debug({
        message: 'Cache miss',
        key,
        namespace,
        correlationId: identifier
      })
      return null
    } catch (error) {
      logger.error({
        message: 'Cache get error',
        key,
        error,
        namespace
      })
      return null
    }
  }

  async set<T>(
    namespace: string,
    identifier: string,
    data: T,
    options?: CacheOptions
  ): Promise<void> {
    const key = this.generateKey(namespace, identifier, options?.namespace ? { namespace: options.namespace } : undefined)
    const ttl = options?.ttl || this.defaultTTL
    
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data))
      
      logger.debug({
        message: 'Cache set',
        key,
        namespace,
        ttl,
        correlationId: identifier
      })
    } catch (error) {
      logger.error({
        message: 'Cache set error',
        key,
        error,
        namespace
      })
    }
  }

  async invalidate(namespace: string, identifier?: string): Promise<void> {
    try {
      if (identifier) {
        // Invalidate specific cache entry
        const pattern = `${this.cachePrefix}${namespace}:${identifier}*`
        const keys = await this.scanKeys(pattern)
        
        if (keys.length > 0) {
          await this.redis.del(...keys)
          logger.debug({
            message: 'Cache invalidated',
            pattern,
            keysInvalidated: keys.length,
            namespace
          })
        }
      } else {
        // Invalidate entire namespace
        const pattern = `${this.cachePrefix}${namespace}:*`
        const keys = await this.scanKeys(pattern)
        
        if (keys.length > 0) {
          await this.redis.del(...keys)
          logger.info({
            message: 'Namespace cache invalidated',
            namespace,
            keysInvalidated: keys.length
          })
        }
      }
    } catch (error) {
      logger.error({
        message: 'Cache invalidation error',
        namespace,
        identifier,
        error
      })
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const fullPattern = `${this.cachePrefix}${pattern}`
      const keys = await this.scanKeys(fullPattern)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
        logger.debug({
          message: 'Pattern cache invalidated',
          pattern: fullPattern,
          keysInvalidated: keys.length
        })
      }
    } catch (error) {
      logger.error({
        message: 'Pattern invalidation error',
        pattern,
        error
      })
    }
  }

  async wrap<T>(
    namespace: string,
    identifier: string,
    fetchFunction: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(namespace, identifier, options?.namespace ? { namespace: options.namespace } : undefined)
    
    if (cached !== null) {
      return cached
    }
    
    // Fetch fresh data
    const data = await fetchFunction()
    
    // Store in cache
    if (data !== null && data !== undefined) {
      await this.set(namespace, identifier, data, options)
    }
    
    return data
  }

  private recordHit(namespace: string): void {
    const metrics = this.metrics.get(namespace) || {
      hits: 0,
      misses: 0,
      hitRate: 0,
      lastReset: new Date()
    }
    
    metrics.hits++
    metrics.hitRate = metrics.hits / (metrics.hits + metrics.misses)
    this.metrics.set(namespace, metrics)
  }

  private recordMiss(namespace: string): void {
    const metrics = this.metrics.get(namespace) || {
      hits: 0,
      misses: 0,
      hitRate: 0,
      lastReset: new Date()
    }
    
    metrics.misses++
    metrics.hitRate = metrics.hits / (metrics.hits + metrics.misses)
    this.metrics.set(namespace, metrics)
  }

  getMetrics(namespace?: string): CacheMetrics | Map<string, CacheMetrics> {
    if (namespace) {
      return this.metrics.get(namespace) || {
        hits: 0,
        misses: 0,
        hitRate: 0,
        lastReset: new Date()
      }
    }
    return new Map(this.metrics)
  }

  async flush(): Promise<void> {
    try {
      const pattern = `${this.cachePrefix}*`
      const keys = await this.scanKeys(pattern)
      
      if (keys.length > 0) {
        await this.redis.del(...keys)
        logger.info({
          message: 'Cache flushed',
          keysDeleted: keys.length
        })
      }
      
      this.metrics.clear()
    } catch (error) {
      logger.error({
        message: 'Cache flush error',
        error
      })
    }
  }

  /**
   * Scan for keys using SCAN instead of KEYS for production safety
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = []
    let cursor = '0'
    
    do {
      const result = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      )
      cursor = result[0]
      keys.push(...result[1])
    } while (cursor !== '0')
    
    return keys
  }

  async warmup(
    namespace: string,
    items: Array<{ id: string; data: unknown; ttl?: number }>
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline()
      
      for (const item of items) {
        const key = this.generateKey(namespace, item.id)
        const ttl = item.ttl || this.defaultTTL
        pipeline.setex(key, ttl, JSON.stringify(item.data))
      }
      
      await pipeline.exec()
      
      logger.info({
        message: 'Cache warmed up',
        namespace,
        itemsWarmed: items.length
      })
    } catch (error) {
      logger.error({
        message: 'Cache warmup error',
        namespace,
        error
      })
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager()