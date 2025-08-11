export interface TransactionOptions {
  isolationLevel?: 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable'
  timeout?: number
}

export interface ITransactionContext {
  commit(): Promise<void>
  rollback(): Promise<void>
  isActive(): boolean
  getId(): string
}

export interface ITransactional {
  beginTransaction(options?: TransactionOptions): Promise<ITransactionContext>
  executeInTransaction<T>(
    callback: (context: ITransactionContext) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>
}