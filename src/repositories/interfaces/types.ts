export interface RepositoryResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export enum RepositoryErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class RepositoryError extends Error {
  constructor(
    public code: RepositoryErrorCode,
    public override message: string,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}

export interface BaseEntity {
  id: string
}

export interface AuditableEntity extends BaseEntity {
  createdAt?: Date
  updatedAt?: Date
  createdBy?: string
  updatedBy?: string
}

export interface SoftDeletableEntity extends BaseEntity {
  deletedAt?: Date | null
  deletedBy?: string | null
}