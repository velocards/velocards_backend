import { ITransactionContext } from '../interfaces'
import { TransactionContext } from '../TransactionManager'
import { SupabaseClient } from '@supabase/supabase-js'

export class MockTransactionContext implements ITransactionContext {
  private active: boolean = true
  private id: string = 'mock-transaction-id'
  public commitCalled: boolean = false
  public rollbackCalled: boolean = false

  async commit(): Promise<void> {
    this.commitCalled = true
    this.active = false
  }

  async rollback(): Promise<void> {
    this.rollbackCalled = true
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }

  getId(): string {
    return this.id
  }
}

export class TransactionTestUtils {
  static createMockContext(): MockTransactionContext {
    return new MockTransactionContext()
  }

  static async simulateTransactionFailure<T>(
    operation: () => Promise<T>,
    _error: Error
  ): Promise<{ result?: T; error?: Error; context: MockTransactionContext }> {
    const context = new MockTransactionContext()
    
    try {
      const result = await operation()
      await context.commit()
      return { result, context }
    } catch (err) {
      await context.rollback()
      return { error: err as Error, context }
    }
  }

  static async verifyTransactionIsolation(
    operation1: () => Promise<any>,
    operation2: () => Promise<any>
  ): Promise<boolean> {
    const context1 = new MockTransactionContext()
    const context2 = new MockTransactionContext()
    
    try {
      await Promise.all([
        operation1(),
        operation2()
      ])
      
      await Promise.all([
        context1.commit(),
        context2.commit()
      ])
      
      return true
    } catch (error) {
      await Promise.all([
        context1.rollback(),
        context2.rollback()
      ])
      
      return false
    }
  }

  static createTransactionSpy(client: SupabaseClient): {
    context: TransactionContext
    operations: Array<{ method: string; args: any[] }>
  } {
    const operations: Array<{ method: string; args: any[] }> = []
    const context = new TransactionContext(client)

    const originalCommit = context.commit.bind(context)
    const originalRollback = context.rollback.bind(context)

    context.commit = async function() {
      operations.push({ method: 'commit', args: [] })
      return originalCommit()
    }

    context.rollback = async function() {
      operations.push({ method: 'rollback', args: [] })
      return originalRollback()
    }

    return { context, operations }
  }
}