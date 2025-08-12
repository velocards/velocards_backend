import { BaseRepository } from './BaseRepository'
import { supabase } from '../config/database'
import { AppError } from '../utils/errors'
import { AuditableEntity } from './interfaces'
import logger from '../utils/logger'

export interface UserBalanceLedger extends AuditableEntity {
  id: string
  user_id: string
  transaction_type: 'deposit' | 'card_funding' | 'refund' | 'withdrawal' | 'fee' | 'adjustment'
  amount: number
  balance_before: number
  balance_after: number
  reference_type?: string
  reference_id?: string
  description?: string
  created_at: Date
}

export interface CreateUserBalanceLedgerData {
  user_id: string
  transaction_type: 'deposit' | 'card_funding' | 'refund' | 'withdrawal' | 'fee' | 'adjustment'
  amount: number
  balance_before: number
  balance_after: number
  reference_type?: string
  reference_id?: string
  description?: string
}

export interface PaginationOptions {
  limit?: number
  page?: number
}

export interface LedgerSummary {
  totalCredits: number
  totalDebits: number
  netAmount: number
  transactionCount: number
  lastTransaction?: Date
}

export class UserBalanceLedgerRepository extends BaseRepository<UserBalanceLedger> {
  constructor() {
    super('user_balance_ledger', supabase)
  }

  async createLedgerEntry(
    data: CreateUserBalanceLedgerData,
    userId?: string
  ): Promise<UserBalanceLedger> {
    try {
      // Validate balance integrity
      const balanceChange = data.balance_after - data.balance_before
      const expectedChange = this.getExpectedBalanceChange(data.transaction_type, data.amount)
      
      if (Math.abs(balanceChange - expectedChange) > 0.01) {
        const errorMsg = `Balance integrity check failed: expected change ${expectedChange}, got ${balanceChange}`
        logger.error(errorMsg, { data })
        throw new AppError(
          'VALIDATION_ERROR',
          errorMsg,
          400
        )
      }

      // Validate balance continuity with previous entry
      const lastEntry = await this.getLastEntryForUser(data.user_id)
      if (lastEntry && Math.abs(lastEntry.balance_after - data.balance_before) > 0.01) {
        const errorMsg = `Balance continuity check failed: last balance ${lastEntry.balance_after}, new balance_before ${data.balance_before}`
        logger.error(errorMsg, { data, lastEntry })
        throw new AppError(
          'VALIDATION_ERROR',
          errorMsg,
          400
        )
      }

      this.logAudit('LEDGER_ENTRY_CREATE', undefined, data, userId)

      const result = await this.create({
        ...data,
        created_at: new Date()
      }, userId)

      logger.info('Created ledger entry', {
        id: result.id,
        userId: result.user_id,
        type: result.transaction_type,
        amount: result.amount,
        balanceAfter: result.balance_after
      })

      return result
    } catch (error) {
      logger.error('Failed to create balance ledger entry', { error, data })
      throw error
    }
  }

  private getExpectedBalanceChange(type: string, amount: number): number {
    // Credit transactions increase balance
    const creditTypes = ['deposit', 'refund', 'adjustment']
    // Debit transactions decrease balance
    const debitTypes = ['card_funding', 'withdrawal', 'fee']
    
    if (creditTypes.includes(type)) {
      return amount
    } else if (debitTypes.includes(type)) {
      return -Math.abs(amount)
    }
    
    // For unknown types, assume the amount indicates the direction
    return amount
  }

  private async getLastEntryForUser(userId: string): Promise<UserBalanceLedger | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }
      
      return data as UserBalanceLedger | null
    } catch (error) {
      logger.error('Error fetching last ledger entry', { error, userId })
      return null
    }
  }

  async findByUserId(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<{ entries: UserBalanceLedger[]; total: number }> {
    try {
      const { limit = 50, page = 1 } = options
      const offset = (page - 1) * limit

      const { count, error: countError } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (countError) {
        throw new AppError('DATABASE_ERROR', countError.message, 500)
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      this.logAudit('LEDGER_QUERY', undefined, { userId, page, limit })

      return {
        entries: (data || []) as UserBalanceLedger[],
        total: count || 0
      }
    } catch (error) {
      logger.error('Error finding balance ledger entries', { error, userId })
      throw error
    }
  }

  async findByUserIdAndType(
    userId: string,
    transactionType: string,
    options: PaginationOptions = {}
  ): Promise<{ entries: UserBalanceLedger[]; total: number }> {
    try {
      const { limit = 50, page = 1 } = options
      const offset = (page - 1) * limit

      const { count, error: countError } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('transaction_type', transactionType)

      if (countError) {
        throw new AppError('DATABASE_ERROR', countError.message, 500)
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_type', transactionType)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return {
        entries: (data || []) as UserBalanceLedger[],
        total: count || 0
      }
    } catch (error) {
      logger.error('Error finding balance ledger entries by type', { error, userId, transactionType })
      throw error
    }
  }

  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    options: PaginationOptions = {}
  ): Promise<{ entries: UserBalanceLedger[]; total: number }> {
    try {
      const { limit = 50, page = 1 } = options
      const offset = (page - 1) * limit

      const { count, error: countError } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (countError) {
        throw new AppError('DATABASE_ERROR', countError.message, 500)
      }

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return {
        entries: (data || []) as UserBalanceLedger[],
        total: count || 0
      }
    } catch (error) {
      logger.error('Error finding balance ledger entries by date range', { error, userId, startDate, endDate })
      throw error
    }
  }

  async getUserBalanceSummary(userId: string): Promise<LedgerSummary> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('amount, created_at')
        .eq('user_id', userId)

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      const entries = data || []
      
      const summary: LedgerSummary = {
        totalCredits: 0,
        totalDebits: 0,
        netAmount: 0,
        transactionCount: entries.length
      }
      
      if (entries.length > 0) {
        summary.lastTransaction = new Date(
          Math.max(...entries.map(e => new Date(e.created_at).getTime()))
        )
      }

      entries.forEach(entry => {
        if (entry.amount > 0) {
          summary.totalCredits += entry.amount
        } else {
          summary.totalDebits += Math.abs(entry.amount)
        }
        summary.netAmount += entry.amount
      })

      this.logAudit('LEDGER_SUMMARY', undefined, { userId, summary })

      return summary
    } catch (error) {
      logger.error('Error getting user balance summary', { error, userId })
      throw error
    }
  }

  async getLatestBalance(userId: string): Promise<number | null> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('balance_after')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return data?.balance_after || null
    } catch (error) {
      logger.error('Error getting latest balance', { error, userId })
      throw error
    }
  }

  async findByReference(
    referenceType: string,
    referenceId: string
  ): Promise<UserBalanceLedger[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('reference_type', referenceType)
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return (data || []) as UserBalanceLedger[]
    } catch (error) {
      logger.error('Error finding balance ledger entries by reference', { error, referenceType, referenceId })
      throw error
    }
  }

  async validateBalance(
    userId: string,
    expectedBalance: number
  ): Promise<{ isValid: boolean; actualBalance: number | null; difference: number }> {
    try {
      const actualBalance = await this.getLatestBalance(userId)
      
      if (actualBalance === null) {
        return {
          isValid: expectedBalance === 0,
          actualBalance,
          difference: expectedBalance
        }
      }

      const difference = Math.abs(expectedBalance - actualBalance)
      const isValid = difference < 0.01

      if (!isValid) {
        logger.warn('Balance validation failed', {
          userId,
          expectedBalance,
          actualBalance,
          difference
        })
      }

      return {
        isValid,
        actualBalance,
        difference
      }
    } catch (error) {
      logger.error('Error validating balance', { error, userId, expectedBalance })
      throw error
    }
  }

  async recalculateBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('amount')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      let balance = 0
      for (const entry of data || []) {
        balance += entry.amount
      }

      logger.info('Recalculated user balance', {
        userId,
        balance,
        transactionCount: data?.length || 0
      })

      this.logAudit('BALANCE_RECALCULATION', undefined, { userId, balance })

      return balance
    } catch (error) {
      logger.error('Error recalculating balance', { error, userId })
      throw error
    }
  }

  async createAdjustmentEntry(
    userId: string,
    adjustmentAmount: number,
    reason: string,
    adminUserId: string
  ): Promise<UserBalanceLedger> {
    try {
      const currentBalance = await this.getLatestBalance(userId) || 0
      const newBalance = currentBalance + adjustmentAmount

      const adjustmentData: CreateUserBalanceLedgerData = {
        user_id: userId,
        transaction_type: 'adjustment',
        amount: adjustmentAmount,
        balance_before: currentBalance,
        balance_after: newBalance,
        reference_type: 'ADMIN_ADJUSTMENT',
        reference_id: adminUserId,
        description: reason
      }

      const result = await this.createLedgerEntry(adjustmentData, adminUserId)

      logger.info('Created balance adjustment', {
        userId,
        adjustmentAmount,
        reason,
        adminUserId,
        newBalance
      })

      return result
    } catch (error) {
      logger.error('Error creating adjustment entry', { error, userId, adjustmentAmount, reason })
      throw error
    }
  }

  static async create(data: CreateUserBalanceLedgerData): Promise<UserBalanceLedger> {
    const instance = new UserBalanceLedgerRepository()
    return instance.createLedgerEntry(data)
  }

  static async findByUserId(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<{ entries: UserBalanceLedger[]; total: number }> {
    const instance = new UserBalanceLedgerRepository()
    return instance.findByUserId(userId, options)
  }

  static async findByUserIdAndType(
    userId: string,
    transactionType: string,
    options: PaginationOptions = {}
  ): Promise<{ entries: UserBalanceLedger[]; total: number }> {
    const instance = new UserBalanceLedgerRepository()
    return instance.findByUserIdAndType(userId, transactionType, options)
  }

  static async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    options: PaginationOptions = {}
  ): Promise<{ entries: UserBalanceLedger[]; total: number }> {
    const instance = new UserBalanceLedgerRepository()
    return instance.findByDateRange(userId, startDate, endDate, options)
  }

  static async getUserBalanceSummary(userId: string): Promise<LedgerSummary> {
    const instance = new UserBalanceLedgerRepository()
    return instance.getUserBalanceSummary(userId)
  }

  static async getLatestBalance(userId: string): Promise<number | null> {
    const instance = new UserBalanceLedgerRepository()
    return instance.getLatestBalance(userId)
  }

  static async findByReference(
    referenceType: string,
    referenceId: string
  ): Promise<UserBalanceLedger[]> {
    const instance = new UserBalanceLedgerRepository()
    return instance.findByReference(referenceType, referenceId)
  }
}