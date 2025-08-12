import { BaseRepository } from '../BaseRepository'
import { BaseEntity, QueryFilters, QueryOptions } from '../interfaces'
import { CacheManager, CacheOptions } from './CacheManager'
import { SupabaseClient } from '@supabase/supabase-js'
import logger from '../../utils/logger'

export interface CacheConfig {
  enabled: boolean
  ttl?: number
  invalidateOnWrite?: boolean
  warmupOnInit?: boolean
  cacheNullValues?: boolean
}

export abstract class CachedRepository<T extends BaseEntity> extends BaseRepository<T> {
  protected cacheManager: CacheManager
  protected cacheConfig: CacheConfig
  protected cacheNamespace: string

  constructor(
    tableName: string,
    cacheManager: CacheManager,
    cacheConfig?: Partial<CacheConfig>,
    supabaseClient?: SupabaseClient
  ) {
    super(tableName, supabaseClient)
    this.cacheManager = cacheManager
    this.cacheNamespace = tableName
    this.cacheConfig = {
      enabled: true,
      ttl: 300, // 5 minutes default
      invalidateOnWrite: true,
      warmupOnInit: false,
      cacheNullValues: false,
      ...cacheConfig
    }

    if (this.cacheConfig.warmupOnInit) {
      this.warmupCache().catch(error => {
        logger.error({
          message: 'Cache warmup failed',
          tableName,
          error
        })
      })
    }
  }

  protected async warmupCache(): Promise<void> {
    // Override in subclasses to implement specific warmup logic
    logger.info({
      message: 'Cache warmup not implemented',
      tableName: this.tableName
    })
  }

  protected getCacheOptions(): CacheOptions {
    const options: CacheOptions = {}
    if (this.cacheConfig.ttl !== undefined) {
      options.ttl = this.cacheConfig.ttl
    }
    if (this.cacheConfig.invalidateOnWrite !== undefined) {
      options.invalidateOnWrite = this.cacheConfig.invalidateOnWrite
    }
    return options
  }

  override async findById(id: string): Promise<T | null> {
    if (!this.cacheConfig.enabled) {
      return super.findById(id)
    }

    const cacheKey = `findById:${id}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => super.findById(id),
      this.getCacheOptions()
    )
  }

  override async findAll(filters?: QueryFilters): Promise<T[]> {
    if (!this.cacheConfig.enabled || filters) {
      // Don't cache filtered queries by default as they can be complex
      return super.findAll(filters)
    }

    const cacheKey = 'findAll:unfiltered'
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => super.findAll(filters),
      { ...this.getCacheOptions(), ttl: 60 } // Shorter TTL for list operations
    )
  }

  override async create(data: Partial<T>, userId?: string): Promise<T> {
    const result = await super.create(data, userId)
    
    if (this.cacheConfig.enabled && this.cacheConfig.invalidateOnWrite) {
      // Invalidate related caches
      await this.invalidateEntityCache(result.id)
      await this.invalidateListCaches()
    }
    
    return result
  }

  override async update(id: string, data: Partial<T>, userId?: string): Promise<T> {
    const result = await super.update(id, data, userId)
    
    if (this.cacheConfig.enabled && this.cacheConfig.invalidateOnWrite) {
      // Invalidate specific entity cache and lists
      await this.invalidateEntityCache(id)
      await this.invalidateListCaches()
    }
    
    return result
  }

  override async delete(id: string, userId?: string): Promise<boolean> {
    const result = await super.delete(id, userId)
    
    if (this.cacheConfig.enabled && this.cacheConfig.invalidateOnWrite && result) {
      // Invalidate specific entity cache and lists
      await this.invalidateEntityCache(id)
      await this.invalidateListCaches()
    }
    
    return result
  }

  override async findOne(where: Record<string, unknown>): Promise<T | null> {
    if (!this.cacheConfig.enabled) {
      return super.findOne(where)
    }

    // Create cache key from where clause
    const whereStr = JSON.stringify(where)
    const cacheKey = `findOne:${Buffer.from(whereStr).toString('base64').substring(0, 32)}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => super.findOne(where),
      this.getCacheOptions()
    )
  }

  override async findMany(where: Record<string, unknown>): Promise<T[]> {
    if (!this.cacheConfig.enabled) {
      return super.findMany(where)
    }

    // Create cache key from where clause
    const whereStr = JSON.stringify(where)
    const cacheKey = `findMany:${Buffer.from(whereStr).toString('base64').substring(0, 32)}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => super.findMany(where),
      { ...this.getCacheOptions(), ttl: 60 } // Shorter TTL for list operations
    )
  }

  override async count(where?: Record<string, unknown>): Promise<number> {
    if (!this.cacheConfig.enabled) {
      return super.count(where)
    }

    const whereStr = where ? JSON.stringify(where) : 'all'
    const cacheKey = `count:${Buffer.from(whereStr).toString('base64').substring(0, 32)}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => super.count(where),
      { ...this.getCacheOptions(), ttl: 30 } // Very short TTL for counts
    )
  }

  override async query(options: QueryOptions): Promise<T[]> {
    if (!this.cacheConfig.enabled) {
      return super.query(options)
    }

    // Complex queries are not cached by default
    // Override in subclass if caching is needed for specific queries
    return super.query(options)
  }

  protected async invalidateEntityCache(id: string): Promise<void> {
    await this.cacheManager.invalidate(this.cacheNamespace, `findById:${id}`)
  }

  protected async invalidateListCaches(): Promise<void> {
    // Invalidate all list-type caches
    await this.cacheManager.invalidatePattern(`${this.cacheNamespace}:findAll:*`)
    await this.cacheManager.invalidatePattern(`${this.cacheNamespace}:findMany:*`)
    await this.cacheManager.invalidatePattern(`${this.cacheNamespace}:count:*`)
  }

  async invalidateAllCaches(): Promise<void> {
    await this.cacheManager.invalidate(this.cacheNamespace)
  }

  async getCacheMetrics() {
    return this.cacheManager.getMetrics(this.cacheNamespace)
  }

  async preloadCache(ids: string[]): Promise<void> {
    if (!this.cacheConfig.enabled || ids.length === 0) {
      return
    }

    const items = await Promise.all(
      ids.map(async id => {
        const data = await super.findById(id)
        return data ? { id: `findById:${id}`, data, ttl: this.cacheConfig.ttl } : null
      })
    )

    const validItems = items.filter(item => item !== null) as Array<{ id: string; data: unknown; ttl?: number }>
    
    if (validItems.length > 0) {
      await this.cacheManager.warmup(this.cacheNamespace, validItems)
    }
  }
}