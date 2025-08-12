import { BaseEntity } from '../interfaces'
import logger from '../../utils/logger'

export interface CursorPaginationOptions {
  limit?: number
  cursor?: string
  direction?: 'forward' | 'backward'
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

export interface CursorPaginationResult<T> {
  data: T[]
  pageInfo: {
    hasNextPage: boolean
    hasPreviousPage: boolean
    startCursor: string | null
    endCursor: string | null
    totalCount?: number
  }
  metadata?: {
    limit: number
    direction: 'forward' | 'backward'
    sortField: string
    sortOrder: 'asc' | 'desc'
  }
}

export interface CursorEncoder {
  encode(data: Record<string, unknown>): string
  decode(cursor: string): Record<string, unknown>
}

export class Base64CursorEncoder implements CursorEncoder {
  encode(data: Record<string, unknown>): string {
    try {
      const json = JSON.stringify(data)
      return Buffer.from(json).toString('base64url')
    } catch (error) {
      logger.error({
        message: 'Failed to encode cursor',
        data,
        error
      })
      return ''
    }
  }

  decode(cursor: string): Record<string, unknown> {
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf-8')
      return JSON.parse(json)
    } catch (error) {
      logger.error({
        message: 'Failed to decode cursor',
        cursor,
        error
      })
      return {}
    }
  }
}

export class CursorPagination<T extends BaseEntity> {
  private encoder: CursorEncoder
  private defaultLimit: number = 50
  private maxLimit: number = 1000

  constructor(encoder?: CursorEncoder) {
    this.encoder = encoder || new Base64CursorEncoder()
  }

  /**
   * Create a cursor from an entity
   */
  createCursor(entity: T, fields: string[] = ['id', 'created_at']): string {
    const cursorData: Record<string, unknown> = {}
    
    for (const field of fields) {
      if (field in entity) {
        cursorData[field] = (entity as Record<string, unknown>)[field]
      }
    }
    
    return this.encoder.encode(cursorData)
  }

  /**
   * Parse a cursor string
   */
  parseCursor(cursor: string): Record<string, unknown> {
    return this.encoder.decode(cursor)
  }

  /**
   * Build pagination query conditions
   */
  buildPaginationConditions(
    options: CursorPaginationOptions
  ): {
    where: Record<string, unknown>
    orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>
    limit: number
  } {
    const limit = Math.min(options.limit || this.defaultLimit, this.maxLimit)
    const sortField = options.sortField || 'created_at'
    const sortOrder = options.sortOrder || 'desc'
    const direction = options.direction || 'forward'
    
    const conditions: {
      where: Record<string, unknown>
      orderBy: Array<{ field: string; direction: 'asc' | 'desc' }>
      limit: number
    } = {
      where: {},
      orderBy: [],
      limit: limit + 1 // Fetch one extra to check for next page
    }

    // Handle cursor-based filtering
    if (options.cursor) {
      const cursorData = this.parseCursor(options.cursor)
      
      if (cursorData[sortField]) {
        const operator = this.getComparisonOperator(sortOrder, direction)
        conditions.where[sortField] = {
          [operator]: cursorData[sortField]
        }
        
        // For compound cursors (e.g., sorting by created_at and id)
        if (cursorData['id'] && sortField !== 'id') {
          // This ensures uniqueness when multiple records have the same sort value
          conditions.where = {
            or: [
              conditions.where,
              {
                [sortField]: cursorData[sortField],
                id: {
                  [direction === 'forward' ? 'gt' : 'lt']: cursorData['id']
                }
              }
            ]
          }
        }
      }
    }

    // Set order by
    const effectiveOrder = direction === 'backward' 
      ? (sortOrder === 'asc' ? 'desc' : 'asc')
      : sortOrder
    
    conditions.orderBy.push({ field: sortField, direction: effectiveOrder })
    
    // Add secondary sort by id for stability
    if (sortField !== 'id') {
      conditions.orderBy.push({ field: 'id', direction: effectiveOrder })
    }

    return conditions
  }

  /**
   * Get the appropriate comparison operator
   */
  private getComparisonOperator(
    sortOrder: 'asc' | 'desc',
    direction: 'forward' | 'backward'
  ): 'gt' | 'lt' | 'gte' | 'lte' {
    if (direction === 'forward') {
      return sortOrder === 'asc' ? 'gt' : 'lt'
    } else {
      return sortOrder === 'asc' ? 'lt' : 'gt'
    }
  }

  /**
   * Process results into paginated response
   */
  processPaginatedResults(
    results: T[],
    options: CursorPaginationOptions,
    totalCount?: number
  ): CursorPaginationResult<T> {
    const limit = Math.min(options.limit || this.defaultLimit, this.maxLimit)
    const direction = options.direction || 'forward'
    const sortField = options.sortField || 'created_at'
    const sortOrder = options.sortOrder || 'desc'
    
    // Check if there's a next page (we fetched limit + 1 records)
    const hasMore = results.length > limit
    
    // Remove the extra record
    if (hasMore) {
      results.pop()
    }
    
    // Reverse results if paginating backward
    if (direction === 'backward') {
      results.reverse()
    }
    
    // Create cursors
    const startCursor = results.length > 0 && results[0]
      ? this.createCursor(results[0] as T, [sortField, 'id'])
      : null
    
    const endCursor = results.length > 0 && results[results.length - 1]
      ? this.createCursor(results[results.length - 1] as T, [sortField, 'id'])
      : null
    
    return {
      data: results,
      pageInfo: {
        hasNextPage: direction === 'forward' ? hasMore : options.cursor !== undefined,
        hasPreviousPage: direction === 'backward' ? hasMore : options.cursor !== undefined,
        startCursor,
        endCursor,
        ...(totalCount !== undefined && { totalCount })
      },
      metadata: {
        limit,
        direction,
        sortField,
        sortOrder
      }
    }
  }

  /**
   * Create a relay-style connection response
   */
  createConnection(
    results: T[],
    options: CursorPaginationOptions,
    totalCount?: number
  ): {
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
  } {
    const paginatedResult = this.processPaginatedResults(results, options, totalCount)
    const sortField = options.sortField || 'created_at'
    
    return {
      edges: paginatedResult.data.map(node => ({
        node,
        cursor: this.createCursor(node, [sortField, 'id'])
      })),
      pageInfo: paginatedResult.pageInfo
    }
  }

  /**
   * Convert offset-based pagination to cursor
   */
  offsetToCursor(offset: number, limit: number): string {
    return this.encoder.encode({ offset, limit })
  }

  /**
   * Convert cursor to offset-based pagination
   */
  cursorToOffset(cursor: string): { offset: number; limit: number } {
    const data = this.parseCursor(cursor)
    return {
      offset: (data['offset'] as number) || 0,
      limit: (data['limit'] as number) || this.defaultLimit
    }
  }

  /**
   * Validate pagination options
   */
  validateOptions(options: CursorPaginationOptions): CursorPaginationOptions {
    const validated = { ...options }
    
    // Validate limit
    if (validated.limit !== undefined) {
      if (validated.limit <= 0) {
        validated.limit = this.defaultLimit
      } else if (validated.limit > this.maxLimit) {
        logger.warn({
          message: 'Pagination limit exceeded maximum',
          requested: validated.limit,
          max: this.maxLimit
        })
        validated.limit = this.maxLimit
      }
    }
    
    // Validate cursor
    if (validated.cursor) {
      try {
        this.parseCursor(validated.cursor)
      } catch (error) {
        logger.warn({
          message: 'Invalid cursor provided',
          cursor: validated.cursor,
          error
        })
        delete validated.cursor
      }
    }
    
    // Validate direction
    if (validated.direction && !['forward', 'backward'].includes(validated.direction)) {
      validated.direction = 'forward'
    }
    
    // Validate sort order
    if (validated.sortOrder && !['asc', 'desc'].includes(validated.sortOrder)) {
      validated.sortOrder = 'desc'
    }
    
    return validated
  }

  /**
   * Generate page info for empty results
   */
  emptyPageInfo(): CursorPaginationResult<T>['pageInfo'] {
    return {
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      endCursor: null,
      totalCount: 0
    }
  }
}

// Export singleton instance for common use
export const cursorPagination = new CursorPagination()