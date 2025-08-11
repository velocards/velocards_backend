import { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository } from './BaseRepository'
import { ITransactional, ITransactionContext, TransactionOptions } from './interfaces'
import { AppError } from '../utils/errors'
import logger from '../utils/logger'
import { z } from 'zod'
import { BaseEntity } from './interfaces'
import { TransactionManager } from './TransactionManager'

// Transaction entity schema - extends BaseEntity
export const TransactionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  card_id: z.string().uuid().optional(),
  admediacards_transaction_id: z.string().optional(),
  type: z.enum(['authorization', 'capture', 'refund', 'reversal', 'deposit', 'withdrawal', 'fee']),
  amount: z.number(),
  currency: z.string(),
  merchant_name: z.string().optional(),
  merchant_category: z.string().optional(),
  merchant_country: z.string().optional(),
  status: z.enum(['pending', 'completed', 'failed', 'reversed', 'disputed']),
  response_code: z.string().optional(),
  response_message: z.string().optional(),
  dispute_reason: z.string().optional(),
  dispute_status: z.enum(['pending', 'resolved', 'rejected']).optional(),
  parent_transaction_id: z.string().uuid().optional(),
  synced_at: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.date(),
  updated_at: z.date(),
  // Version field for optimistic locking
  version: z.number().int().default(0)
})

export type Transaction = z.infer<typeof TransactionSchema> & BaseEntity

// Transaction filters schema
export const TransactionFiltersSchema = z.object({
  card_id: z.string().uuid().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  from_date: z.date().optional(),
  to_date: z.date().optional(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  merchant_name: z.string().optional()
})

export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>

// Pagination options schema
export const PaginationOptionsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(1000).default(20), // Increased max to 1000
  orderBy: z.enum(['created_at', 'amount']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional()
})

export type PaginationOptions = z.infer<typeof PaginationOptionsSchema>

class TransactionRepositoryClass extends BaseRepository<Transaction> implements ITransactional {
  private transactionManager: TransactionManager

  constructor(supabaseClient?: SupabaseClient) {
    super('transactions', supabaseClient)
    this.transactionManager = new TransactionManager(this.supabase)
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(options?: TransactionOptions): Promise<ITransactionContext> {
    return await this.transactionManager.beginTransaction(options)
  }

  /**
   * Execute operations in a transaction
   */
  async executeInTransaction<T>(
    callback: (context: ITransactionContext) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    return await this.transactionManager.executeInTransaction(callback, options)
  }

  /**
   * Get transactions for a user with filters and pagination
   * Maintains backward compatibility with existing method
   */
  async findByUser(
    userId: string, 
    filters: TransactionFilters = {}, 
    pagination: PaginationOptions
  ): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      // Validate inputs
      const validatedFilters = TransactionFiltersSchema.parse(filters)
      const validatedPagination = PaginationOptionsSchema.parse(pagination)

      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('user_id', userId)

      // Apply filters
      if (validatedFilters.card_id) {
        query = query.eq('card_id', validatedFilters.card_id)
      }
      if (validatedFilters.type) {
        query = query.eq('type', validatedFilters.type)
      }
      if (validatedFilters.status) {
        query = query.eq('status', validatedFilters.status)
      }
      if (validatedFilters.from_date) {
        query = query.gte('created_at', validatedFilters.from_date.toISOString())
      }
      if (validatedFilters.to_date) {
        query = query.lte('created_at', validatedFilters.to_date.toISOString())
      }
      if (validatedFilters.min_amount !== undefined) {
        query = query.gte('amount', validatedFilters.min_amount)
      }
      if (validatedFilters.max_amount !== undefined) {
        query = query.lte('amount', validatedFilters.max_amount)
      }
      if (validatedFilters.merchant_name) {
        // Escape special characters in LIKE patterns to prevent injection
        const escapedMerchantName = validatedFilters.merchant_name
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/%/g, '\\%')     // Escape percent signs
          .replace(/_/g, '\\_')     // Escape underscores
        query = query.ilike('merchant_name', `%${escapedMerchantName}%`)
      }

      // Apply ordering
      const orderBy = validatedPagination.orderBy || 'created_at'
      const orderDirection = validatedPagination.orderDirection || 'desc'
      query = query.order(orderBy, { ascending: orderDirection === 'asc' })

      // Apply pagination
      const { page, limit } = validatedPagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error

      return {
        transactions: (data || []) as Transaction[],
        total: count || 0
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError('VALIDATION_ERROR', `Invalid filter data: ${error.errors[0]?.message}`, 400)
      }
      logger.error('Failed to find user transactions:', error)
      throw this.mapDatabaseError(error)
    }
  }

  /**
   * Get transactions for a specific card
   */
  async findByCard(
    cardId: string, 
    pagination: PaginationOptions
  ): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const validatedPagination = PaginationOptionsSchema.parse(pagination)
      const { page, limit } = validatedPagination
      const offset = (page - 1) * limit

      const { data, error, count } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) throw error

      return {
        transactions: (data || []) as Transaction[],
        total: count || 0
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError('VALIDATION_ERROR', `Invalid pagination data: ${error.errors[0]?.message}`, 400)
      }
      logger.error('Failed to find card transactions:', error)
      throw this.mapDatabaseError(error)
    }
  }

  /**
   * Create a new transaction
   * Overrides base create to add audit logging for financial operations
   */
  override async create(data: Partial<Transaction>, userId?: string): Promise<Transaction> {
    try {
      // Initialize version for optimistic locking
      const transactionData = {
        ...data,
        version: 0
      }

      this.logAudit('CREATE_TRANSACTION', undefined, transactionData, userId || (data as any).user_id)

      const result = await super.create(transactionData, userId || (data as any).user_id)
      
      logger.info(`Transaction created`, { 
        transactionId: result.id,
        type: result.type,
        amount: result.amount,
        correlationId: this.correlationId
      })

      return result
    } catch (error) {
      logger.error('Failed to create transaction:', error)
      throw error
    }
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    transactionId: string, 
    status: Transaction['status'],
    additionalData?: Partial<Transaction>,
    userId?: string
  ): Promise<Transaction> {
    try {
      const updateData: Partial<Transaction> = { 
        status,
        ...additionalData
      }

      // Increment version for optimistic locking
      const currentTransaction = await this.findById(transactionId)
      if (!currentTransaction) {
        throw new AppError('NOT_FOUND', 'Transaction not found', 404)
      }
      
      updateData.version = (currentTransaction.version || 0) + 1

      this.logAudit('UPDATE_TRANSACTION_STATUS', transactionId, updateData, userId)

      const result = await super.update(transactionId, updateData, userId)
      
      logger.info(`Transaction status updated`, {
        transactionId,
        status,
        correlationId: this.correlationId
      })

      return result
    } catch (error) {
      logger.error('Failed to update transaction status:', error)
      throw error
    }
  }

  /**
   * Create a dispute for a transaction
   */
  async createDispute(
    transactionId: string,
    reason: string,
    userId?: string
  ): Promise<Transaction> {
    try {
      const updateData = {
        status: 'disputed' as const,
        dispute_reason: reason,
        dispute_status: 'pending' as const
      }

      this.logAudit('CREATE_DISPUTE', transactionId, { reason }, userId)

      const result = await this.updateStatus(transactionId, 'disputed', updateData, userId)
      
      logger.info(`Transaction disputed`, { 
        transactionId, 
        reason,
        correlationId: this.correlationId
      })

      return result
    } catch (error) {
      logger.error('Failed to create dispute:', error)
      throw error
    }
  }

  /**
   * Get transaction statistics for a user
   */
  async getUserStats(userId: string, period?: { from: Date; to: Date }) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('type, status, amount, currency')
        .eq('user_id', userId)
        .eq('status', 'completed')

      if (period) {
        query = query
          .gte('created_at', period.from.toISOString())
          .lte('created_at', period.to.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Calculate statistics
      const stats = {
        totalTransactions: data?.length || 0,
        totalAmount: data?.reduce((sum, tx) => sum + tx.amount, 0) || 0,
        byType: {} as Record<string, number>,
        byCurrency: {} as Record<string, number>
      }

      data?.forEach(tx => {
        stats.byType[tx.type] = (stats.byType[tx.type] || 0) + 1
        stats.byCurrency[tx.currency] = (stats.byCurrency[tx.currency] || 0) + tx.amount
      })

      return stats
    } catch (error) {
      logger.error('Failed to get user stats:', error)
      throw this.mapDatabaseError(error)
    }
  }

  /**
   * Sync transaction from Admediacards
   */
  async syncFromAdmediacards(cardId: string, admediacardsTransaction: any): Promise<Transaction> {
    return await this.executeInTransaction(async (_context) => {
      // Check if transaction already exists
      const existingTx = await this.findOne({ 
        admediacards_transaction_id: admediacardsTransaction.TransactionID 
      })

      if (existingTx) {
        // Update existing transaction
        const updated = await this.update(existingTx.id, {
          status: this.mapAdmediacardsStatus(admediacardsTransaction.Status),
          response_code: admediacardsTransaction.ResponseCode,
          response_message: admediacardsTransaction.ResponseMessage,
          synced_at: new Date(),
          metadata: {
            ...admediacardsTransaction,
            last_sync: new Date().toISOString()
          }
        })

        return updated
      } else {
        // Get card to find user_id
        const { data: card } = await this.supabase
          .from('virtual_cards')
          .select('user_id')
          .eq('id', cardId)
          .single()

        if (!card) {
          throw new AppError('NOT_FOUND', 'Card not found', 404)
        }

        // Create new transaction
        const created = await this.create({
          user_id: card.user_id,
          card_id: cardId,
          admediacards_transaction_id: admediacardsTransaction.TransactionID,
          type: this.mapAdmediacardsType(admediacardsTransaction.Type),
          amount: admediacardsTransaction.Amount,
          currency: admediacardsTransaction.Currency || 'USD',
          merchant_name: admediacardsTransaction.MerchantName,
          merchant_category: admediacardsTransaction.MerchantCategory,
          merchant_country: admediacardsTransaction.MerchantCountry,
          status: this.mapAdmediacardsStatus(admediacardsTransaction.Status),
          response_code: admediacardsTransaction.ResponseCode,
          response_message: admediacardsTransaction.ResponseMessage,
          synced_at: new Date(),
          metadata: admediacardsTransaction
        })

        return created
      }
    })
  }

  /**
   * Map Admediacards transaction type to our type
   */
  private mapAdmediacardsType(type: string): Transaction['type'] {
    const typeMap: Record<string, Transaction['type']> = {
      'AUTHORIZATION': 'authorization',
      'CAPTURE': 'capture',
      'REFUND': 'refund',
      'REVERSAL': 'reversal',
      'AUTHORIZATION_REVERSAL': 'reversal'
    }
    return typeMap[type?.toUpperCase()] || 'authorization'
  }

  /**
   * Map Admediacards status to our status
   */
  private mapAdmediacardsStatus(status: string): Transaction['status'] {
    const statusMap: Record<string, Transaction['status']> = {
      'APPROVED': 'completed',
      'DECLINED': 'failed',
      'PENDING': 'pending',
      'REVERSED': 'reversed'
    }
    return statusMap[status?.toUpperCase()] || 'pending'
  }
}

// Export singleton instance for backward compatibility
export const TransactionRepository = new TransactionRepositoryClass()