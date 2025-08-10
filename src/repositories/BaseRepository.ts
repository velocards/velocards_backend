/**
 * Generic base repository with improved type safety
 */

import { SupabaseClient } from '@supabase/supabase-js';
import supabase from '../config/database';
import { DatabaseError, NotFoundError } from '../types/errors';

/**
 * Base entity interface
 */
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string | null;
}

/**
 * Generic create input type
 */
export type CreateInput<T extends BaseEntity> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/**
 * Generic update input type
 */
export type UpdateInput<T extends BaseEntity> = Partial<Omit<T, 'id' | 'created_at'>>;

/**
 * Query filters interface
 */
export interface QueryFilters {
  where?: Record<string, unknown>;
  orderBy?: {
    column: string;
    ascending: boolean;
  };
  limit?: number;
  offset?: number;
}

/**
 * Paginated result interface
 */
export interface PaginatedResult<T> {
  data: T[];
  count: number;
  total: number;
  hasMore: boolean;
}

/**
 * Generic base repository class
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected readonly client: SupabaseClient;
  protected abstract readonly tableName: string;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data as T | null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to find ${this.tableName} by id`,
        `SELECT * FROM ${this.tableName} WHERE id = $1`,
        error
      );
    }
  }

  /**
   * Find entity by ID or throw NotFoundError
   */
  async findByIdOrThrow(id: string): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundError(this.tableName, id);
    }
    return entity;
  }

  /**
   * Find entities with optional filters
   */
  async findMany(filters?: QueryFilters): Promise<T[]> {
    try {
      let query = this.client.from(this.tableName).select('*');

      if (filters?.where) {
        Object.entries(filters.where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (filters?.orderBy) {
        query = query.order(filters.orderBy.column, {
          ascending: filters.orderBy.ascending
        });
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 1000) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as T[];
    } catch (error) {
      throw new DatabaseError(
        `Failed to find ${this.tableName} entities`,
        undefined,
        error
      );
    }
  }

  /**
   * Find entities with pagination
   */
  async findWithPagination(
    filters?: Omit<QueryFilters, 'offset'> & {
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<T>> {
    try {
      const page = filters?.page || 1;
      const pageSize = filters?.pageSize || 10;
      const offset = (page - 1) * pageSize;

      let query = this.client
        .from(this.tableName)
        .select('*', { count: 'exact' });

      if (filters?.where) {
        Object.entries(filters.where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (filters?.orderBy) {
        query = query.order(filters.orderBy.column, {
          ascending: filters.orderBy.ascending
        });
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []) as T[],
        count: data?.length || 0,
        total: count || 0,
        hasMore: count ? offset + pageSize < count : false
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to find paginated ${this.tableName} entities`,
        undefined,
        error
      );
    }
  }

  /**
   * Create new entity
   */
  async create(input: CreateInput<T>): Promise<T> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert([input])
        .select()
        .single();

      if (error) throw error;

      return data as T;
    } catch (error) {
      throw new DatabaseError(
        `Failed to create ${this.tableName}`,
        undefined,
        error
      );
    }
  }

  /**
   * Create multiple entities
   */
  async createMany(inputs: CreateInput<T>[]): Promise<T[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert(inputs)
        .select();

      if (error) throw error;

      return (data || []) as T[];
    } catch (error) {
      throw new DatabaseError(
        `Failed to create multiple ${this.tableName}`,
        undefined,
        error
      );
    }
  }

  /**
   * Update entity by ID
   */
  async update(id: string, input: UpdateInput<T>): Promise<T> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new NotFoundError(this.tableName, id);

      return data as T;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new DatabaseError(
        `Failed to update ${this.tableName}`,
        undefined,
        error
      );
    }
  }

  /**
   * Update multiple entities
   */
  async updateMany(
    where: Record<string, unknown>,
    input: UpdateInput<T>
  ): Promise<T[]> {
    try {
      let query = this.client
        .from(this.tableName)
        .update({
          ...input,
          updated_at: new Date().toISOString()
        });

      Object.entries(where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data, error } = await query.select();

      if (error) throw error;

      return (data || []) as T[];
    } catch (error) {
      throw new DatabaseError(
        `Failed to update multiple ${this.tableName}`,
        undefined,
        error
      );
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete ${this.tableName}`,
        undefined,
        error
      );
    }
  }

  /**
   * Delete multiple entities
   */
  async deleteMany(where: Record<string, unknown>): Promise<number> {
    try {
      let query = this.client
        .from(this.tableName)
        .delete({ count: 'exact' });

      Object.entries(where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { count, error } = await query;

      if (error) throw error;

      return count || 0;
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete multiple ${this.tableName}`,
        undefined,
        error
      );
    }
  }

  /**
   * Check if entity exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select('id')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      throw new DatabaseError(
        `Failed to check if ${this.tableName} exists`,
        undefined,
        error
      );
    }
  }

  /**
   * Count entities with optional filters
   */
  async count(where?: Record<string, unknown>): Promise<number> {
    try {
      let query = this.client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (where) {
        Object.entries(where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { count, error } = await query;

      if (error) throw error;

      return count || 0;
    } catch (error) {
      throw new DatabaseError(
        `Failed to count ${this.tableName}`,
        undefined,
        error
      );
    }
  }

  /**
   * Execute raw query with type safety
   */
  protected async executeQuery<R = T[]>(
    query: string,
    params?: unknown[]
  ): Promise<R> {
    try {
      const { data, error } = await this.client.rpc('execute_sql', {
        query,
        params: params || []
      });

      if (error) throw error;

      return data as R;
    } catch (error) {
      throw new DatabaseError(
        `Failed to execute query on ${this.tableName}`,
        query,
        error
      );
    }
  }

  /**
   * Transaction wrapper with type safety
   */
  async transaction<R>(
    callback: (client: SupabaseClient) => Promise<R>
  ): Promise<R> {
    // Note: Supabase doesn't have built-in transactions like traditional SQL clients
    // This is a placeholder for when transaction support is added
    return await callback(this.client);
  }

  /**
   * Upsert entity (insert or update)
   */
  async upsert(
    input: CreateInput<T> & { id?: string },
    onConflict?: string[]
  ): Promise<T> {
    try {
      const options = onConflict ? { onConflict: onConflict.join(',') } : undefined;
      const { data, error } = await this.client
        .from(this.tableName)
        .upsert([input], options)
        .select()
        .single();

      if (error) throw error;

      return data as T;
    } catch (error) {
      throw new DatabaseError(
        `Failed to upsert ${this.tableName}`,
        undefined,
        error
      );
    }
  }
}