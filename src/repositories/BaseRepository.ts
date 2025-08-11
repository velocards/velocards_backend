import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../config/database'
import logger from '../utils/logger'
import { AppError, DatabaseError } from '../utils/errors'
import {
  IRepository,
  IQueryable,
  QueryFilters,
  QueryOptions,
  AuditableEntity,
  BaseEntity
} from './interfaces'

export abstract class BaseRepository<T extends BaseEntity>
  implements IRepository<T>, IQueryable<T>
{
  protected supabase: SupabaseClient
  protected tableName: string
  protected correlationId: string
  private retryCount: number = 3
  private retryDelay: number = 1000

  constructor(tableName: string, supabaseClient?: SupabaseClient) {
    this.tableName = tableName
    this.supabase = supabaseClient || supabase
    this.correlationId = uuidv4()
  }

  protected setCorrelationId(id?: string): void {
    this.correlationId = id || uuidv4()
  }

  protected logAudit(
    operation: string,
    entityId: string | undefined,
    data?: unknown,
    userId?: string
  ): void {
    logger.info({
      type: 'AUDIT',
      operation,
      tableName: this.tableName,
      entityId,
      userId,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      data: data ? JSON.stringify(data) : undefined
    })
  }

  protected async retry<T>(
    operation: () => Promise<T>,
    retries: number = this.retryCount
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        logger.warn({
          message: 'Retrying operation',
          tableName: this.tableName,
          retriesLeft: retries - 1,
          correlationId: this.correlationId,
          error: error
        })
        await new Promise(resolve => setTimeout(resolve, this.retryDelay))
        return this.retry(operation, retries - 1)
      }
      throw error
    }
  }

  private isRetryableError(error: unknown): boolean {
    const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']
    const err = error as { code?: string; message?: string }
    return (
      (err?.code && retryableCodes.includes(err.code)) ||
      (err?.message?.includes('connection') ?? false) ||
      (err?.message?.includes('timeout') ?? false)
    )
  }

  protected mapDatabaseError(error: unknown): AppError {
    const err = error as { code?: string; message?: string; detail?: string; hint?: string }
    logger.error({
      message: 'Database operation failed',
      tableName: this.tableName,
      correlationId: this.correlationId,
      error: {
        code: err?.code,
        message: err?.message,
        detail: err?.detail,
        hint: err?.hint
      }
    })

    if (err?.code === '23505') {
      return new AppError('DUPLICATE_ENTRY', 'Resource already exists', 409)
    }
    if (err?.code === '23503') {
      return new AppError('FOREIGN_KEY_VIOLATION', 'Related resource not found', 400)
    }
    if (err?.code === '23502') {
      return new AppError('NOT_NULL_VIOLATION', 'Required field missing', 400)
    }
    if (err?.code === '22P02') {
      return new AppError('INVALID_INPUT', 'Invalid input format', 400)
    }

    return new DatabaseError('Database operation failed', error)
  }

  protected addAuditFields<T extends Partial<AuditableEntity>>(
    data: T,
    userId?: string,
    isUpdate: boolean = false
  ): T {
    const now = new Date()
    if (isUpdate) {
      return {
        ...data,
        updated_at: now,
        updated_by: userId
      }
    }
    return {
      ...data,
      created_at: now,
      updated_at: now,
      created_by: userId,
      updated_by: userId
    }
  }

  async create(data: Partial<T>, userId?: string): Promise<T> {
    return this.retry(async () => {
      try {
        const id = (data as Record<string, unknown>)['id'] as string || uuidv4()
        const recordData = this.addAuditFields(
          { ...data, id } as Partial<T & AuditableEntity>,
          userId,
          false
        )

        this.logAudit('CREATE', id, recordData, userId)

        const { data: result, error } = await this.supabase
          .from(this.tableName)
          .insert(recordData)
          .select()
          .single()

        if (error) throw error

        logger.info({
          message: 'Entity created successfully',
          tableName: this.tableName,
          entityId: id,
          correlationId: this.correlationId
        })

        return result as T
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  async findById(id: string): Promise<T | null> {
    return this.retry(async () => {
      try {
        const query = this.supabase
          .from(this.tableName)
          .select('*')
          .eq('id', id)

        if (this.isSoftDeletable()) {
          query.is('deleted_at', null)
        }

        const { data, error } = await query.single()

        if (error) {
          if (error.code === 'PGRST116') {
            return null
          }
          throw error
        }

        return data as T
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  async findAll(filters?: QueryFilters): Promise<T[]> {
    return this.retry(async () => {
      try {
        let query = this.supabase.from(this.tableName).select('*')

        if (this.isSoftDeletable()) {
          query = query.is('deleted_at', null)
        }

        if (filters) {
          const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', ...where } = filters

          Object.entries(where).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              query = query.eq(key, value)
            }
          })

          const from = (page - 1) * limit
          const to = from + limit - 1

          query = query
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range(from, to)
        }

        const result = await query

        if (result.error) throw result.error

        return (result.data as unknown as T[]) || []
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  async update(id: string, data: Partial<T>, userId?: string): Promise<T> {
    return this.retry(async () => {
      try {
        const updateData = this.addAuditFields(data as Partial<T & AuditableEntity>, userId, true)

        this.logAudit('UPDATE', id, updateData, userId)

        const { data: result, error } = await this.supabase
          .from(this.tableName)
          .update(updateData)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            throw new AppError('NOT_FOUND', 'Resource not found', 404)
          }
          throw error
        }

        logger.info({
          message: 'Entity updated successfully',
          tableName: this.tableName,
          entityId: id,
          correlationId: this.correlationId
        })

        return result as T
      } catch (error) {
        if (error instanceof AppError) throw error
        throw this.mapDatabaseError(error)
      }
    })
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    return this.retry(async () => {
      try {
        if (this.isSoftDeletable()) {
          const deleteData = {
            deleted_at: new Date(),
            deleted_by: userId
          }

          this.logAudit('SOFT_DELETE', id, deleteData, userId)

          const { error } = await this.supabase
            .from(this.tableName)
            .update(deleteData)
            .eq('id', id)

          if (error) throw error
        } else {
          this.logAudit('HARD_DELETE', id, undefined, userId)

          const { error } = await this.supabase
            .from(this.tableName)
            .delete()
            .eq('id', id)

          if (error) throw error
        }

        logger.info({
          message: 'Entity deleted successfully',
          tableName: this.tableName,
          entityId: id,
          correlationId: this.correlationId
        })

        return true
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  async exists(id: string): Promise<boolean> {
    try {
      const query = this.supabase
        .from(this.tableName)
        .select('id')
        .eq('id', id)

      if (this.isSoftDeletable()) {
        query.is('deletedAt', null)
      }

      const { data, error } = await query.single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return !!data
    } catch (error) {
      throw this.mapDatabaseError(error)
    }
  }

  async query(options: QueryOptions): Promise<T[]> {
    return this.retry(async () => {
      try {
        const selectFields = options.select?.join(', ') || '*'
        let query = this.supabase.from(this.tableName).select(selectFields)

        if (this.isSoftDeletable()) {
          query = query.is('deleted_at', null)
        }

        if (options.where) {
          Object.entries(options.where).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              query = query.eq(key, value)
            }
          })
        }

        if (options.orderBy) {
          options.orderBy.forEach(({ field, direction }) => {
            query = query.order(field, { ascending: direction === 'asc' })
          })
        }

        if (options.limit) {
          query = query.limit(options.limit)
        }

        if (options.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
        }

        const result = await query

        if (result.error) throw result.error

        return (result.data as unknown as T[]) || []
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return this.retry(async () => {
      try {
        let query = this.supabase
          .from(this.tableName)
          .select('*', { count: 'exact', head: true })

        if (this.isSoftDeletable()) {
          query = query.is('deleted_at', null)
        }

        if (where) {
          Object.entries(where).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              query = query.eq(key, value)
            }
          })
        }

        const { count, error } = await query

        if (error) throw error

        return count || 0
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  async findOne(where: Record<string, unknown>): Promise<T | null> {
    return this.retry(async () => {
      try {
        let query = this.supabase.from(this.tableName).select('*')

        if (this.isSoftDeletable()) {
          query = query.is('deleted_at', null)
        }

        Object.entries(where).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        })

        const { data, error } = await query.single()

        if (error) {
          if (error.code === 'PGRST116') {
            return null
          }
          throw error
        }

        return data as T
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  async findMany(where: Record<string, unknown>): Promise<T[]> {
    return this.retry(async () => {
      try {
        let query = this.supabase.from(this.tableName).select('*')

        if (this.isSoftDeletable()) {
          query = query.is('deleted_at', null)
        }

        Object.entries(where).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        })

        const result = await query

        if (result.error) throw result.error

        return (result.data as unknown as T[]) || []
      } catch (error) {
        throw this.mapDatabaseError(error)
      }
    })
  }

  protected isSoftDeletable(): boolean {
    return false
  }
}