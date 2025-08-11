export interface QueryFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: string | number | boolean | undefined
}

import { BaseEntity } from './types'

export interface IRepository<T extends BaseEntity> {
  create(data: Partial<T>): Promise<T>
  findById(id: string): Promise<T | null>
  findAll(filters?: QueryFilters): Promise<T[]>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<boolean>
  exists(id: string): Promise<boolean>
}