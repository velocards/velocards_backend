import { BaseRepository } from './BaseRepository'
import { supabase } from '../config/database'
import { AppError } from '../utils/errors'
import { AuditableEntity } from './interfaces'
import logger from '../utils/logger'

export interface CryptoTransaction extends AuditableEntity {
  id: string
  user_id: string
  xmoney_payment_id: string
  type: 'deposit' | 'withdrawal'
  crypto_currency: string
  crypto_amount: number
  fiat_currency: string
  fiat_amount: number
  exchange_rate?: number
  wallet_address?: string
  transaction_hash?: string
  confirmations?: number
  status: 'pending' | 'confirming' | 'completed' | 'failed' | 'expired'
  fee_amount?: number
  synced_at?: Date
  metadata?: Record<string, any>
  created_at: Date
  updated_at: Date
}

export interface CreateCryptoTransactionData {
  user_id: string
  xmoney_payment_id: string
  type: 'deposit' | 'withdrawal'
  crypto_currency: string
  crypto_amount: number
  fiat_currency: string
  fiat_amount: number
  exchange_rate?: number
  wallet_address?: string
  status?: 'pending' | 'confirming' | 'completed' | 'failed'
  metadata?: Record<string, any>
}

export interface UpdateCryptoTransactionData {
  status?: 'pending' | 'confirming' | 'completed' | 'failed' | 'expired'
  crypto_amount?: number
  fiat_amount?: number
  exchange_rate?: number
  transaction_hash?: string
  confirmations?: number
  fee_amount?: number
  synced_at?: Date
  metadata?: Record<string, any>
}

export class CryptoTransactionRepository extends BaseRepository<CryptoTransaction> {
  constructor() {
    super('crypto_transactions', supabase)
  }

  async createTransaction(
    data: CreateCryptoTransactionData,
    userId?: string
  ): Promise<CryptoTransaction> {
    try {
      const transactionData: Partial<CryptoTransaction> = {
        ...data,
        status: data.status || 'pending',
        confirmations: 0,
        created_at: new Date(),
        updated_at: new Date()
      }

      this.logAudit('CRYPTO_TRANSACTION_CREATE', undefined, transactionData, userId)

      const result = await this.create(transactionData, userId)

      logger.info('Created crypto transaction', {
        id: result.id,
        type: result.type,
        userId: result.user_id,
        amount: result.crypto_amount,
        currency: result.crypto_currency
      })

      return result
    } catch (error) {
      logger.error('Failed to create crypto transaction', { error, data })
      throw error
    }
  }

  async findByXMoneyId(xmoneyPaymentId: string): Promise<CryptoTransaction | null> {
    try {
      const result = await this.findOne({ xmoney_payment_id: xmoneyPaymentId })
      
      if (result) {
        this.logAudit('CRYPTO_TRANSACTION_FIND', result.id, { xmoneyPaymentId })
      }

      return result
    } catch (error) {
      logger.error('Failed to find crypto transaction by xMoney ID', { error, xmoneyPaymentId })
      throw error
    }
  }

  async findByUserId(userId: string): Promise<CryptoTransaction[]> {
    try {
      const result = await this.query({
        where: { user_id: userId },
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      })

      this.logAudit('CRYPTO_TRANSACTION_LIST', undefined, { userId, count: result.length })

      return result
    } catch (error) {
      logger.error('Failed to find crypto transactions by user ID', { error, userId })
      throw error
    }
  }

  async findPendingByUser(userId: string): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'confirming'])
        .order('created_at', { ascending: false })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return (data || []) as CryptoTransaction[]
    } catch (error) {
      logger.error('Failed to find pending crypto transactions', { error, userId })
      throw error
    }
  }

  async findPendingAfter(cutoffTime: Date): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('status', ['pending', 'confirming'])
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return (data || []) as CryptoTransaction[]
    } catch (error) {
      logger.error('Failed to find pending crypto transactions after cutoff', { error, cutoffTime })
      throw error
    }
  }

  async findStuckOrders(cutoffTime: Date): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', 'pending')
        .lt('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      const stuckOrders = (data || []) as CryptoTransaction[]

      if (stuckOrders.length > 0) {
        logger.warn(`Found ${stuckOrders.length} stuck crypto orders`, {
          cutoffTime,
          orderIds: stuckOrders.map(o => o.id)
        })
      }

      return stuckOrders
    } catch (error) {
      logger.error('Failed to find stuck crypto orders', { error, cutoffTime })
      throw error
    }
  }

  async findExpiredOrders(cutoffTime: Date): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('status', ['pending', 'confirming'])
        .lt('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return (data || []) as CryptoTransaction[]
    } catch (error) {
      logger.error('Failed to find expired crypto orders', { error, cutoffTime })
      throw error
    }
  }

  async findInconsistentStates(): Promise<CryptoTransaction[]> {
    try {
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('status', ['pending', 'confirming'])
        .or(`synced_at.is.null,synced_at.lt.${oneHourAgo.toISOString()}`)
        .order('created_at', { ascending: true })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      const inconsistentOrders = (data || []) as CryptoTransaction[]

      if (inconsistentOrders.length > 0) {
        logger.warn(`Found ${inconsistentOrders.length} crypto orders with inconsistent states`)
      }

      return inconsistentOrders
    } catch (error) {
      logger.error('Failed to find inconsistent crypto orders', { error })
      throw error
    }
  }

  async updateFromXMoney(
    id: string,
    data: UpdateCryptoTransactionData,
    userId?: string
  ): Promise<CryptoTransaction> {
    try {
      const updateData = {
        ...data,
        synced_at: new Date(),
        updated_at: new Date()
      }

      this.logAudit('CRYPTO_TRANSACTION_SYNC', id, updateData, userId)

      const result = await this.update(id, updateData, userId)

      logger.info('Updated crypto transaction from xMoney', {
        id,
        status: result.status,
        confirmations: result.confirmations
      })

      return result
    } catch (error) {
      logger.error('Failed to update crypto transaction from xMoney', { error, id, data })
      throw error
    }
  }

  async markAsProcessed(id: string): Promise<void> {
    try {
      const metadata = {
        processed_at: new Date().toISOString()
      }

      await this.update(id, {
        metadata,
        updated_at: new Date()
      })

      this.logAudit('CRYPTO_TRANSACTION_PROCESSED', id, metadata)

      logger.info(`Marked crypto transaction ${id} as processed`)
    } catch (error) {
      logger.error('Failed to mark crypto transaction as processed', { error, id })
      throw error
    }
  }

  async markAsExpired(id: string): Promise<void> {
    try {
      await this.update(id, {
        status: 'expired',
        updated_at: new Date()
      })

      this.logAudit('CRYPTO_TRANSACTION_EXPIRED', id)

      logger.info(`Marked crypto transaction ${id} as expired`)
    } catch (error) {
      logger.error('Failed to mark crypto transaction as expired', { error, id })
      throw error
    }
  }

  async getTransactionStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalDeposits: number
    totalWithdrawals: number
    pendingCount: number
    completedCount: number
    failedCount: number
    totalVolume: number
  }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('type, status, fiat_amount')
        .eq('user_id', userId)

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }

      if (endDate) {
        query = query.lte('created_at', endDate.toISOString())
      }

      const { data, error } = await query

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      const transactions = (data || []) as Array<{
        type: string
        status: string
        fiat_amount: number
      }>

      const stats = {
        totalDeposits: 0,
        totalWithdrawals: 0,
        pendingCount: 0,
        completedCount: 0,
        failedCount: 0,
        totalVolume: 0
      }

      for (const tx of transactions) {
        if (tx.type === 'deposit') {
          stats.totalDeposits += tx.fiat_amount
        } else if (tx.type === 'withdrawal') {
          stats.totalWithdrawals += tx.fiat_amount
        }

        if (tx.status === 'pending' || tx.status === 'confirming') {
          stats.pendingCount++
        } else if (tx.status === 'completed') {
          stats.completedCount++
          stats.totalVolume += tx.fiat_amount
        } else if (tx.status === 'failed') {
          stats.failedCount++
        }
      }

      return stats
    } catch (error) {
      logger.error('Failed to get transaction stats', { error, userId })
      throw error
    }
  }

  static async create(data: CreateCryptoTransactionData): Promise<CryptoTransaction> {
    const instance = new CryptoTransactionRepository()
    return instance.createTransaction(data)
  }

  static async findById(id: string): Promise<CryptoTransaction | null> {
    const instance = new CryptoTransactionRepository()
    return instance.findById(id)
  }

  static async findByXMoneyId(xmoneyPaymentId: string): Promise<CryptoTransaction | null> {
    const instance = new CryptoTransactionRepository()
    return instance.findByXMoneyId(xmoneyPaymentId)
  }

  static async findByUserId(userId: string): Promise<CryptoTransaction[]> {
    const instance = new CryptoTransactionRepository()
    return instance.findByUserId(userId)
  }

  static async findPendingByUser(userId: string): Promise<CryptoTransaction[]> {
    const instance = new CryptoTransactionRepository()
    return instance.findPendingByUser(userId)
  }

  static async findPendingAfter(cutoffTime: Date): Promise<CryptoTransaction[]> {
    const instance = new CryptoTransactionRepository()
    return instance.findPendingAfter(cutoffTime)
  }

  static async findStuckOrders(cutoffTime: Date): Promise<CryptoTransaction[]> {
    const instance = new CryptoTransactionRepository()
    return instance.findStuckOrders(cutoffTime)
  }

  static async findExpiredOrders(cutoffTime: Date): Promise<CryptoTransaction[]> {
    const instance = new CryptoTransactionRepository()
    return instance.findExpiredOrders(cutoffTime)
  }

  static async findInconsistentStates(): Promise<CryptoTransaction[]> {
    const instance = new CryptoTransactionRepository()
    return instance.findInconsistentStates()
  }

  static async updateFromXMoney(id: string, data: UpdateCryptoTransactionData): Promise<CryptoTransaction> {
    const instance = new CryptoTransactionRepository()
    return instance.updateFromXMoney(id, data)
  }

  static async markAsProcessed(id: string): Promise<void> {
    const instance = new CryptoTransactionRepository()
    return instance.markAsProcessed(id)
  }

  static async markAsExpired(id: string): Promise<void> {
    const instance = new CryptoTransactionRepository()
    return instance.markAsExpired(id)
  }
}