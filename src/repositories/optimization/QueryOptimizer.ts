import { QueryFilters, QueryOptions } from '../interfaces'
import logger from '../../utils/logger'

export interface BatchOperation<T> {
  operation: 'create' | 'update' | 'delete'
  data: T
  id?: string
}

export interface QueryPlan {
  useIndex?: string
  estimatedRows?: number
  strategy: 'index_scan' | 'sequential_scan' | 'bitmap_scan'
  optimizations: string[]
}

export class QueryOptimizer {
  private queryPlans: Map<string, QueryPlan> = new Map()

  /**
   * Optimize query filters for better performance
   */
  optimizeFilters(filters?: QueryFilters): QueryFilters | undefined {
    if (!filters) return undefined

    const optimized: QueryFilters = { ...filters }

    // Ensure pagination limits are reasonable
    if (optimized.limit && optimized.limit > 1000) {
      logger.warn({
        message: 'Query limit exceeded maximum, capping at 1000',
        originalLimit: optimized.limit
      })
      optimized.limit = 1000
    }

    // Default pagination if not specified
    if (!optimized.limit) {
      optimized.limit = 50
    }
    if (!optimized.page) {
      optimized.page = 1
    }

    // Optimize sort fields to use indexed columns
    if (optimized.sortBy) {
      optimized.sortBy = this.optimizeSortField(optimized.sortBy)
    }

    return optimized
  }

  /**
   * Optimize sort fields to use indexed columns
   */
  private optimizeSortField(field: string): string {
    const indexedFields: Record<string, string> = {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      userId: 'user_id',
      cardId: 'card_id',
      transactionDate: 'created_at',
      amount: 'amount'
    }

    return indexedFields[field] || field
  }

  /**
   * Batch multiple operations for efficiency
   */
  async batchOperations<T>(
    operations: BatchOperation<T>[],
    executor: (batch: BatchOperation<T>[]) => Promise<void>,
    batchSize: number = 100
  ): Promise<void> {
    const batches = this.createBatches(operations, batchSize)
    
    for (const batch of batches) {
      await executor(batch)
      
      logger.debug({
        message: 'Batch operation completed',
        batchSize: batch.length,
        operation: batch[0]?.operation
      })
    }
  }

  /**
   * Create batches from array of operations
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    
    return batches
  }

  /**
   * Optimize query options for complex queries
   */
  optimizeQueryOptions(options: QueryOptions): QueryOptions {
    const optimized: QueryOptions = { ...options }

    // Limit select fields to reduce data transfer
    if (!optimized.select || optimized.select.length === 0) {
      // Don't select all fields by default
      delete optimized.select
    }

    // Optimize ordering for indexed columns
    if (optimized.orderBy) {
      optimized.orderBy = optimized.orderBy.map(order => ({
        field: this.optimizeSortField(order.field),
        direction: order.direction
      }))
    }

    // Apply reasonable limits
    if (!optimized.limit) {
      optimized.limit = 100
    } else if (optimized.limit > 1000) {
      optimized.limit = 1000
    }

    return optimized
  }

  /**
   * Analyze query pattern and suggest optimizations
   */
  analyzeQueryPattern(
    tableName: string,
    filters?: Record<string, unknown>,
    options?: QueryOptions
  ): QueryPlan {
    const key = this.generateQueryKey(tableName, filters, options)
    
    // Check cached plan
    const cachedPlan = this.queryPlans.get(key)
    if (cachedPlan) {
      return cachedPlan
    }

    const plan: QueryPlan = {
      strategy: 'sequential_scan',
      optimizations: []
    }

    // Analyze filters for index usage
    if (filters) {
      const filterKeys = Object.keys(filters)
      
      // Check for indexed fields
      if (this.hasIndexedField(tableName, filterKeys)) {
        plan.strategy = 'index_scan'
        plan.useIndex = this.suggestIndex(tableName, filterKeys)
        plan.optimizations.push('Using index for filter')
      }

      // Check for range queries
      if (this.hasRangeQuery(filters)) {
        plan.strategy = 'bitmap_scan'
        plan.optimizations.push('Using bitmap scan for range query')
      }
    }

    // Analyze sorting
    if (options?.orderBy) {
      const sortFields = options.orderBy.map(o => o.field)
      if (this.hasIndexedField(tableName, sortFields)) {
        plan.optimizations.push('Using index for sorting')
      } else {
        plan.optimizations.push('Consider adding index for sort field')
      }
    }

    // Cache the plan
    this.queryPlans.set(key, plan)
    
    return plan
  }

  /**
   * Generate a unique key for query pattern
   */
  private generateQueryKey(
    tableName: string,
    filters?: Record<string, unknown>,
    options?: QueryOptions
  ): string {
    const filterStr = filters ? JSON.stringify(filters) : ''
    const optionStr = options ? JSON.stringify(options) : ''
    return `${tableName}:${filterStr}:${optionStr}`
  }

  /**
   * Check if query uses indexed fields
   */
  private hasIndexedField(tableName: string, fields: string[]): boolean {
    const indexedFields: Record<string, string[]> = {
      users: ['id', 'email', 'username', 'is_active', 'kyc_status'],
      cards: ['id', 'user_id', 'card_number_hash', 'status', 'card_type'],
      transactions: ['id', 'user_id', 'card_id', 'status', 'transaction_type', 'created_at'],
      user_balance_ledger: ['id', 'user_id', 'transaction_type', 'created_at'],
      audit_logs: ['user_id', 'entity_type', 'entity_id', 'action', 'created_at'],
      user_security_keys: ['key_hash', 'user_id', 'key_type', 'is_active']
    }

    const tableIndexes = indexedFields[tableName] || []
    return fields.some(field => tableIndexes.includes(field))
  }

  /**
   * Suggest the best index for query
   */
  private suggestIndex(tableName: string, fields: string[]): string {
    const indexMap: Record<string, Record<string, string>> = {
      users: {
        email: 'idx_users_email',
        username: 'idx_users_username',
        is_active: 'idx_users_active_status',
        kyc_status: 'idx_users_kyc_status'
      },
      cards: {
        user_id: 'idx_cards_user_lookup',
        card_number_hash: 'idx_cards_hash',
        status: 'idx_cards_active_type'
      },
      transactions: {
        user_id: 'idx_transactions_user_history',
        card_id: 'idx_transactions_card_history',
        status: 'idx_transactions_status',
        transaction_type: 'idx_transactions_type'
      }
    }

    const tableIndexes = indexMap[tableName] || {}
    
    for (const field of fields) {
      if (tableIndexes[field]) {
        return tableIndexes[field]
      }
    }
    
    return 'primary_key_index'
  }

  /**
   * Check if query contains range conditions
   */
  private hasRangeQuery(filters: Record<string, unknown>): boolean {
    return Object.values(filters).some(value => {
      if (typeof value === 'object' && value !== null) {
        const keys = Object.keys(value)
        return keys.some(k => ['gt', 'gte', 'lt', 'lte', 'between'].includes(k))
      }
      return false
    })
  }

  /**
   * Optimize N+1 query patterns
   */
  async preventNPlusOne<R>(
    parentIds: string[],
    fetchFunction: (ids: string[]) => Promise<Map<string, R[]>>,
    batchSize: number = 100
  ): Promise<Map<string, R[]>> {
    const result = new Map<string, R[]>()
    
    // Batch the parent IDs to avoid huge IN clauses
    const batches = this.createBatches(parentIds, batchSize)
    
    for (const batch of batches) {
      const batchResult = await fetchFunction(batch)
      batchResult.forEach((value, key) => {
        result.set(key, value)
      })
    }
    
    return result
  }

  /**
   * Clear cached query plans
   */
  clearQueryPlans(): void {
    this.queryPlans.clear()
    logger.info('Query plans cache cleared')
  }

  /**
   * Get query plan statistics
   */
  getQueryPlanStats(): {
    totalPlans: number
    plansByStrategy: Record<string, number>
  } {
    const stats = {
      totalPlans: this.queryPlans.size,
      plansByStrategy: {} as Record<string, number>
    }

    this.queryPlans.forEach(plan => {
      stats.plansByStrategy[plan.strategy] = (stats.plansByStrategy[plan.strategy] || 0) + 1
    })

    return stats
  }
}

// Singleton instance
export const queryOptimizer = new QueryOptimizer()