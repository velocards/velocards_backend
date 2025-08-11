export interface QueryOptions {
  select?: string[]
  where?: Record<string, unknown>
  orderBy?: { field: string; direction: 'asc' | 'desc' }[]
  limit?: number
  offset?: number
  include?: string[]
}

import { BaseEntity } from './types'

export interface IQueryable<T extends BaseEntity> {
  query(options: QueryOptions): Promise<T[]>
  count(where?: Record<string, unknown>): Promise<number>
  findOne(where: Record<string, unknown>): Promise<T | null>
  findMany(where: Record<string, unknown>): Promise<T[]>
}