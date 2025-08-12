import { CachedRepository, CacheConfig } from '../cache/CachedRepository'
import { BaseEntity, QueryOptions } from '../interfaces'
import { CacheManager } from '../cache/CacheManager'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  CursorPagination,
  CursorPaginationOptions,
  CursorPaginationResult
} from './CursorPagination'
import { performanceMonitor } from '../monitoring/PerformanceMonitor'
import logger from '../../utils/logger'
import { v4 as uuidv4 } from 'uuid'

export abstract class PaginatedRepository<T extends BaseEntity> extends CachedRepository<T> {
  protected cursorPagination: CursorPagination<T>
  protected enablePerformanceMonitoring: boolean = true

  constructor(
    tableName: string,
    cacheManager: CacheManager,
    cacheConfig?: Partial<CacheConfig>,
    supabaseClient?: SupabaseClient
  ) {
    super(tableName, cacheManager, cacheConfig, supabaseClient)
    this.cursorPagination = new CursorPagination<T>()
  }

  /**
   * Find with cursor-based pagination
   */
  async findWithCursor(
    options: CursorPaginationOptions & { where?: Record<string, unknown> }
  ): Promise<CursorPaginationResult<T>> {
    const correlationId = uuidv4()
    
    if (this.enablePerformanceMonitoring) {
      await performanceMonitor.startOperation(this.tableName, 'findWithCursor', correlationId)
    }

    try {
      // Validate options
      const validatedOptions = this.cursorPagination.validateOptions(options)
      
      // Build pagination conditions
      const conditions = this.cursorPagination.buildPaginationConditions(validatedOptions)
      
      // Merge with additional where conditions
      if (options.where) {
        conditions.where = { ...conditions.where, ...options.where }
      }
      
      // Execute query
      const queryOptions: QueryOptions = {
        where: conditions.where,
        orderBy: conditions.orderBy,
        limit: conditions.limit
      }
      
      const results = await this.query(queryOptions)
      
      // Get total count if needed (can be expensive)
      let totalCount: number | undefined
      if (options.where) {
        totalCount = await this.count(options.where)
      }
      
      // Process results into paginated response
      const paginatedResult = this.cursorPagination.processPaginatedResults(
        results,
        validatedOptions,
        totalCount
      )
      
      if (this.enablePerformanceMonitoring) {
        const queryDetails: { filters?: Record<string, unknown>; limit?: number; offset?: number } = {
          offset: 0
        }
        if (validatedOptions.limit !== undefined) {
          queryDetails.limit = validatedOptions.limit
        }
        if (options.where) {
          queryDetails.filters = options.where
        }
        await performanceMonitor.endOperation(
          this.tableName,
          'findWithCursor',
          correlationId,
          'success',
          undefined,
          queryDetails
        )
      }
      
      return paginatedResult
    } catch (error) {
      if (this.enablePerformanceMonitoring) {
        await performanceMonitor.endOperation(
          this.tableName,
          'findWithCursor',
          correlationId,
          'error',
          (error as Error).message
        )
      }
      throw error
    }
  }

  /**
   * Find with optimized streaming for large datasets
   */
  async *findStream(
    options: {
      where?: Record<string, unknown>
      batchSize?: number
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): AsyncGenerator<T[], void, unknown> {
    const batchSize = options.batchSize || 100
    let cursor: string | undefined
    let hasMore = true
    
    while (hasMore) {
      const paginationOptions: CursorPaginationOptions & { where?: Record<string, unknown> } = {
        limit: batchSize
      }
      if (options.where) paginationOptions.where = options.where
      if (cursor) paginationOptions.cursor = cursor
      if (options.sortField) paginationOptions.sortField = options.sortField
      if (options.sortOrder) paginationOptions.sortOrder = options.sortOrder
      
      const result = await this.findWithCursor(paginationOptions)
      
      if (result.data.length > 0) {
        yield result.data
      }
      
      hasMore = result.pageInfo.hasNextPage
      cursor = result.pageInfo.endCursor || undefined
    }
  }

  /**
   * Find all with automatic pagination handling
   */
  async findAllPaginated(
    options: {
      where?: Record<string, unknown>
      maxRecords?: number
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<T[]> {
    const maxRecords = options.maxRecords || 10000
    const results: T[] = []
    let cursor: string | undefined
    let hasMore = true
    const batchSize = 1000
    
    while (hasMore && results.length < maxRecords) {
      const paginationOptions: CursorPaginationOptions & { where?: Record<string, unknown> } = {
        limit: Math.min(batchSize, maxRecords - results.length)
      }
      if (options.where) paginationOptions.where = options.where
      if (cursor) paginationOptions.cursor = cursor
      if (options.sortField) paginationOptions.sortField = options.sortField
      if (options.sortOrder) paginationOptions.sortOrder = options.sortOrder
      
      const result = await this.findWithCursor(paginationOptions)
      
      results.push(...result.data)
      hasMore = result.pageInfo.hasNextPage
      cursor = result.pageInfo.endCursor || undefined
      
      if (results.length >= maxRecords) {
        logger.warn({
          message: 'Maximum records limit reached',
          tableName: this.tableName,
          maxRecords,
          actualCount: results.length
        })
        break
      }
    }
    
    return results
  }

  /**
   * Find with relay-style cursor connection
   */
  async findConnection(
    options: CursorPaginationOptions & { where?: Record<string, unknown> }
  ): Promise<{
    edges: Array<{
      node: T
      cursor: string
    }>
    pageInfo: {
      hasNextPage: boolean
      hasPreviousPage: boolean
      startCursor: string | null
      endCursor: string | null
      totalCount?: number
    }
  }> {
    const result = await this.findWithCursor(options)
    const sortField = options.sortField || 'created_at'
    
    return {
      edges: result.data.map(node => ({
        node,
        cursor: this.cursorPagination.createCursor(node, [sortField, 'id'])
      })),
      pageInfo: result.pageInfo
    }
  }

  /**
   * Get page of results with traditional offset pagination (less efficient)
   */
  async getPage(
    page: number,
    pageSize: number,
    options?: {
      where?: Record<string, unknown>
      sortField?: string
      sortOrder?: 'asc' | 'desc'
    }
  ): Promise<{
    data: T[]
    page: number
    pageSize: number
    totalPages: number
    totalCount: number
    hasNext: boolean
    hasPrevious: boolean
  }> {
    const offset = (page - 1) * pageSize
    
    const queryOptions: QueryOptions = {
      limit: pageSize,
      offset
    }
    if (options?.where) queryOptions.where = options.where
    if (options?.sortField) {
      queryOptions.orderBy = [
        { field: options.sortField, direction: options.sortOrder || 'desc' }
      ]
    }
    
    const [data, totalCount] = await Promise.all([
      this.query(queryOptions),
      this.count(options?.where)
    ])
    
    const totalPages = Math.ceil(totalCount / pageSize)
    
    return {
      data,
      page,
      pageSize,
      totalPages,
      totalCount,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    }
  }

  /**
   * Process large datasets in batches
   */
  async processBatch<R>(
    processor: (batch: T[]) => Promise<R>,
    options: {
      where?: Record<string, unknown>
      batchSize?: number
      parallel?: boolean
      maxConcurrency?: number
    } = {}
  ): Promise<R[]> {
    const results: R[] = []
    const batchSize = options.batchSize || 100
    const parallel = options.parallel || false
    const maxConcurrency = options.maxConcurrency || 5
    
    if (parallel) {
      const promises: Promise<R>[] = []
      let activePromises = 0
      
      const streamOptions: { where?: Record<string, unknown>; batchSize?: number; sortField?: string; sortOrder?: 'asc' | 'desc' } = {
        batchSize
      }
      if (options.where) streamOptions.where = options.where
      
      for await (const batch of this.findStream(streamOptions)) {
        while (activePromises >= maxConcurrency) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        activePromises++
        const promise = processor(batch).then(result => {
          activePromises--
          return result
        })
        promises.push(promise)
      }
      
      const batchResults = await Promise.all(promises)
      results.push(...batchResults)
    } else {
      const streamOptions: { where?: Record<string, unknown>; batchSize?: number; sortField?: string; sortOrder?: 'asc' | 'desc' } = {
        batchSize
      }
      if (options.where) streamOptions.where = options.where
      
      for await (const batch of this.findStream(streamOptions)) {
        const result = await processor(batch)
        results.push(result)
      }
    }
    
    return results
  }

  /**
   * Override query to add performance monitoring
   */
  override async query(options: QueryOptions): Promise<T[]> {
    const correlationId = uuidv4()
    
    if (this.enablePerformanceMonitoring) {
      await performanceMonitor.startOperation(this.tableName, 'query', correlationId)
    }

    try {
      const results = await super.query(options)
      
      if (this.enablePerformanceMonitoring) {
        const queryDetails: { filters?: Record<string, unknown>; limit?: number; offset?: number } = {}
        if (options.where) queryDetails.filters = options.where
        if (options.limit !== undefined) queryDetails.limit = options.limit
        if (options.offset !== undefined) queryDetails.offset = options.offset
        
        await performanceMonitor.endOperation(
          this.tableName,
          'query',
          correlationId,
          'success',
          undefined,
          queryDetails
        )
      }
      
      return results
    } catch (error) {
      if (this.enablePerformanceMonitoring) {
        await performanceMonitor.endOperation(
          this.tableName,
          'query',
          correlationId,
          'error',
          (error as Error).message
        )
      }
      throw error
    }
  }

  /**
   * Get performance metrics for this repository
   */
  async getPerformanceMetrics() {
    return performanceMonitor.getStats(this.tableName)
  }

  /**
   * Get slow queries for this repository
   */
  async getSlowQueries(limit: number = 10) {
    const allSlowQueries = await performanceMonitor.getSlowQueries(limit * 2)
    return allSlowQueries
      .filter(q => q.repository === this.tableName)
      .slice(0, limit)
  }
}