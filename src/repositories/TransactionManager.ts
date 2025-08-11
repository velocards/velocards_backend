import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../config/database'
import logger from '../utils/logger'
import { DatabaseError } from '../utils/errors'
import { ITransactional, ITransactionContext, TransactionOptions } from './interfaces'

/**
 * Transaction implementation using Supabase RPC functions and optimistic locking
 * Since Supabase doesn't natively support transactions, we implement:
 * 1. Optimistic locking with version fields
 * 2. Compensation-based rollback
 * 3. Atomic operations where possible
 */
export class TransactionContext implements ITransactionContext {
  private id: string
  private active: boolean
  private client: SupabaseClient
  private operations: Array<{
    table: string
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
    data: Record<string, unknown>
    previousData?: Record<string, unknown>
    id?: string
  }> = []
  private compensations: Array<() => Promise<void>> = []

  constructor(client: SupabaseClient) {
    this.id = uuidv4()
    this.active = true
    this.client = client
    logger.debug({
      message: 'Transaction started',
      transactionId: this.id,
      timestamp: new Date().toISOString()
    })
  }

  async commit(): Promise<void> {
    if (!this.active) {
      throw new DatabaseError('Transaction is not active')
    }

    try {
      // Execute all pending operations
      for (const op of this.operations) {
        await this.executeOperation(op)
      }

      logger.info({
        message: 'Transaction committed',
        transactionId: this.id,
        operations: this.operations.length,
        timestamp: new Date().toISOString()
      })
      
      this.active = false
      this.operations = []
      this.compensations = []
    } catch (error) {
      logger.error({
        message: 'Transaction commit failed, initiating rollback',
        transactionId: this.id,
        error: error
      })
      await this.rollback()
      throw new DatabaseError('Failed to commit transaction', error)
    }
  }

  async rollback(): Promise<void> {
    if (!this.active) {
      return
    }

    try {
      // Execute compensations in reverse order
      for (let i = this.compensations.length - 1; i >= 0; i--) {
        try {
          const compensation = this.compensations[i]
          if (compensation) {
            await compensation()
          }
        } catch (compError) {
          logger.error({
            message: 'Compensation failed during rollback',
            transactionId: this.id,
            compensationIndex: i,
            error: compError
          })
        }
      }

      logger.info({
        message: 'Transaction rolled back',
        transactionId: this.id,
        compensations: this.compensations.length,
        timestamp: new Date().toISOString()
      })
      
      this.active = false
      this.operations = []
      this.compensations = []
    } catch (error) {
      logger.error({
        message: 'Transaction rollback failed',
        transactionId: this.id,
        error: error
      })
      throw new DatabaseError('Failed to rollback transaction', error)
    }
  }

  isActive(): boolean {
    return this.active
  }

  getId(): string {
    return this.id
  }

  /**
   * Register an operation to be executed on commit
   */
  registerOperation(
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    data: Record<string, unknown>,
    id?: string
  ): void {
    if (!this.active) {
      throw new DatabaseError('Cannot register operation on inactive transaction')
    }

    if (id !== undefined) {
      this.operations.push({ table, operation, data, id })
    } else {
      this.operations.push({ table, operation, data })
    }
  }

  /**
   * Execute a single operation and register its compensation
   */
  private async executeOperation(op: {
    table: string
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
    data: Record<string, unknown>
    id?: string
  }): Promise<void> {
    switch (op.operation) {
      case 'INSERT':
        await this.executeInsert(op.table, op.data)
        break
      case 'UPDATE':
        if (!op.id) throw new DatabaseError('Update operation requires an ID')
        await this.executeUpdate(op.table, op.id, op.data)
        break
      case 'DELETE':
        if (!op.id) throw new DatabaseError('Delete operation requires an ID')
        await this.executeDelete(op.table, op.id)
        break
    }
  }

  private async executeInsert(table: string, data: Record<string, unknown>): Promise<void> {
    const { data: inserted, error } = await this.client
      .from(table)
      .insert(data)
      .select()
      .single()

    if (error) {
      throw new DatabaseError(`Insert failed: ${error.message}`, error)
    }

    // Register compensation (delete the inserted record)
    this.compensations.push(async () => {
      const id = (inserted as Record<string, unknown>)['id']
      if (id) {
        await this.client.from(table).delete().eq('id', id)
      }
    })
  }

  private async executeUpdate(table: string, id: string, data: Record<string, unknown>): Promise<void> {
    // First, get the current data for rollback
    const { data: current, error: fetchError } = await this.client
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      throw new DatabaseError(`Failed to fetch current data: ${fetchError.message}`, fetchError)
    }

    // Implement optimistic locking using version field if available
    const updateData = { ...data }
    if (current && 'version' in current) {
      updateData['version'] = (current['version'] as number) + 1
      
      const { error } = await this.client
        .from(table)
        .update(updateData)
        .eq('id', id)
        .eq('version', current['version'])

      if (error) {
        throw new DatabaseError(`Update failed (optimistic lock): ${error.message}`, error)
      }
    } else {
      const { error } = await this.client
        .from(table)
        .update(updateData)
        .eq('id', id)

      if (error) {
        throw new DatabaseError(`Update failed: ${error.message}`, error)
      }
    }

    // Register compensation (restore previous data)
    this.compensations.push(async () => {
      if (current) {
        await this.client.from(table).update(current).eq('id', id)
      }
    })
  }

  private async executeDelete(table: string, id: string): Promise<void> {
    // First, get the current data for rollback
    const { data: current, error: fetchError } = await this.client
      .from(table)
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      throw new DatabaseError(`Failed to fetch data for delete: ${fetchError.message}`, fetchError)
    }

    const { error } = await this.client
      .from(table)
      .delete()
      .eq('id', id)

    if (error) {
      throw new DatabaseError(`Delete failed: ${error.message}`, error)
    }

    // Register compensation (restore deleted record)
    this.compensations.push(async () => {
      if (current) {
        await this.client.from(table).insert(current)
      }
    })
  }

  /**
   * Execute an RPC function within the transaction context
   * Useful for complex atomic operations
   */
  async executeRPC<T>(functionName: string, params: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(functionName, {
      ...params,
      transaction_id: this.id
    })

    if (error) {
      throw new DatabaseError(`RPC execution failed: ${error.message}`, error)
    }

    return data as T
  }
}

export class TransactionManager implements ITransactional {
  private client: SupabaseClient
  private activeTransactions: Map<string, TransactionContext> = new Map()
  private defaultTimeout: number = 30000

  constructor(client?: SupabaseClient) {
    this.client = client || supabase
  }

  async beginTransaction(options?: TransactionOptions): Promise<ITransactionContext> {
    const context = new TransactionContext(this.client)
    this.activeTransactions.set(context.getId(), context)

    const timeout = options?.timeout || this.defaultTimeout
    setTimeout(() => {
      if (context.isActive()) {
        logger.warn({
          message: 'Transaction timeout - auto-rollback',
          transactionId: context.getId(),
          timeout: timeout
        })
        context.rollback().catch(err => {
          logger.error({
            message: 'Auto-rollback failed',
            transactionId: context.getId(),
            error: err
          })
        })
      }
    }, timeout)

    return context
  }

  async executeInTransaction<T>(
    callback: (context: ITransactionContext) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const context = await this.beginTransaction(options)
    
    try {
      const result = await callback(context)
      await context.commit()
      return result
    } catch (error) {
      await context.rollback()
      logger.error({
        message: 'Transaction execution failed',
        transactionId: context.getId(),
        error: error
      })
      throw error
    } finally {
      this.activeTransactions.delete(context.getId())
    }
  }

  async cleanup(): Promise<void> {
    const promises: Promise<void>[] = []
    
    for (const [id, context] of this.activeTransactions) {
      if (context.isActive()) {
        logger.warn({
          message: 'Cleaning up active transaction',
          transactionId: id
        })
        promises.push(context.rollback())
      }
    }

    await Promise.all(promises)
    this.activeTransactions.clear()
  }

  /**
   * Create a Supabase RPC function for atomic operations
   * This should be run during database setup
   */
  static getAtomicTransferRPCSQL(): string {
    return `
      CREATE OR REPLACE FUNCTION atomic_balance_transfer(
        from_user_id UUID,
        to_user_id UUID,
        amount DECIMAL,
        transaction_id UUID
      ) RETURNS JSON AS $$
      DECLARE
        from_balance DECIMAL;
        result JSON;
      BEGIN
        -- Lock the rows for update
        SELECT virtual_balance INTO from_balance
        FROM user_profiles
        WHERE id = from_user_id
        FOR UPDATE;

        IF from_balance < amount THEN
          RAISE EXCEPTION 'Insufficient balance';
        END IF;

        -- Update sender balance
        UPDATE user_profiles
        SET virtual_balance = virtual_balance - amount,
            updated_at = NOW()
        WHERE id = from_user_id;

        -- Update receiver balance
        UPDATE user_profiles
        SET virtual_balance = virtual_balance + amount,
            updated_at = NOW()
        WHERE id = to_user_id;

        -- Log the transaction
        INSERT INTO user_balance_ledger (
          id, user_id, transaction_type, amount,
          balance_before, balance_after, reference_type,
          description, created_at
        ) VALUES (
          gen_random_uuid(), from_user_id, 'transfer_out', amount,
          from_balance, from_balance - amount, 'transfer',
          'Transfer to ' || to_user_id, NOW()
        );

        result := json_build_object(
          'success', true,
          'transaction_id', transaction_id,
          'from_balance', from_balance - amount
        );

        RETURN result;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
  }
}

export const transactionManager = new TransactionManager()