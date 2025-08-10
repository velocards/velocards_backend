/**
 * Enhanced generic utility functions with proper constraints and type safety
 */

/**
 * Utility types for better generic constraints
 */
export type NonEmptyArray<T> = [T, ...T[]];
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Generic array utilities with proper constraints
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be greater than 0');
  
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function groupBy<T, K extends string | number | symbol>(
  array: T[],
  keySelector: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keySelector(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

export function mapToObject<T, K extends string | number | symbol, V>(
  array: T[],
  keySelector: (item: T) => K,
  valueSelector: (item: T) => V
): Record<K, V> {
  return array.reduce((obj, item) => {
    const key = keySelector(item);
    obj[key] = valueSelector(item);
    return obj;
  }, {} as Record<K, V>);
}

export function unique<T>(array: T[]): T[];
export function unique<T, K>(array: T[], keySelector: (item: T) => K): T[];
export function unique<T, K>(array: T[], keySelector?: (item: T) => K): T[] {
  if (!keySelector) {
    return [...new Set(array)];
  }
  
  const seen = new Set<K>();
  return array.filter(item => {
    const key = keySelector(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function partition<T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];
  
  for (const item of array) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  
  return [truthy, falsy];
}

/**
 * Generic object utilities with proper constraints
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

export function omit<T, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function mapValues<T, U>(
  obj: Record<string, T>,
  mapper: (value: T, key: string) => U
): Record<string, U> {
  const result: Record<string, U> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = mapper(value, key);
  }
  return result;
}

export function mapKeys<T>(
  obj: Record<string, T>,
  mapper: (key: string, value: T) => string
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = mapper(key, value);
    result[newKey] = value;
  }
  return result;
}

/**
 * Generic validation utilities
 */
export function validateRequired<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

export function validateArray<T>(
  value: unknown,
  itemValidator: (item: unknown) => item is T,
  fieldName: string
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  
  return value.map((item, index) => {
    if (!itemValidator(item)) {
      throw new Error(`${fieldName}[${index}] is invalid`);
    }
    return item;
  });
}

export function validateObject<T>(
  value: unknown,
  validator: (obj: unknown) => obj is T,
  fieldName: string
): T {
  if (!validator(value)) {
    throw new Error(`${fieldName} is invalid`);
  }
  return value;
}

/**
 * Generic async utilities
 */
export async function mapAsync<T, U>(
  array: T[],
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  return Promise.all(array.map(mapper));
}

export async function mapAsyncSequential<T, U>(
  array: T[],
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results: U[] = [];
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (item !== undefined) {
      results.push(await mapper(item, i));
    }
  }
  return results;
}

export async function filterAsync<T>(
  array: T[],
  predicate: (item: T) => Promise<boolean>
): Promise<T[]> {
  const results = await mapAsync(array, async (item) => ({
    item,
    keep: await predicate(item)
  }));
  
  return results
    .filter(({ keep }) => keep)
    .map(({ item }) => item);
}

export async function reduceAsync<T, U>(
  array: T[],
  reducer: (accumulator: U, current: T, index: number) => Promise<U>,
  initialValue: U
): Promise<U> {
  let accumulator = initialValue;
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (item !== undefined) {
      accumulator = await reducer(accumulator, item, i);
    }
  }
  return accumulator;
}

/**
 * Generic caching utilities
 */
export function memoize<T extends unknown[], R>(
  fn: (...args: T) => R,
  keyGenerator?: (...args: T) => string
): (...args: T) => R {
  const cache = new Map<string, R>();
  
  return (...args: T): R => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

export function memoizeAsync<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator?: (...args: T) => string,
  ttlMs?: number
): (...args: T) => Promise<R> {
  const cache = new Map<string, { value: Promise<R>; expires: number | undefined }>();
  
  return async (...args: T): Promise<R> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    const now = Date.now();
    
    const cached = cache.get(key);
    if (cached && (cached.expires === undefined || cached.expires > now)) {
      return cached.value;
    }
    
    const promise = fn(...args);
    const expiresAt = ttlMs ? now + ttlMs : undefined;
    cache.set(key, {
      value: promise,
      expires: expiresAt
    });
    
    return promise;
  };
}

/**
 * Generic result type for error handling
 */
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

export async function tryCatch<T, E = Error>(
  fn: () => Promise<T>,
  errorMapper?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    const mappedError = errorMapper ? errorMapper(error) : (error as E);
    return failure(mappedError);
  }
}

export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

/**
 * Generic type narrowing utilities
 */
export function assertType<T>(
  value: unknown,
  predicate: (value: unknown) => value is T,
  message?: string
): asserts value is T {
  if (!predicate(value)) {
    throw new Error(message || 'Type assertion failed');
  }
}

export function narrowType<T, U extends T>(
  value: T,
  predicate: (value: T) => value is U
): U | null {
  return predicate(value) ? value : null;
}

/**
 * Generic builder pattern utilities
 */
export class Builder<T> {
  private data: Partial<T> = {};

  set<K extends keyof T>(key: K, value: T[K]): Builder<T> {
    this.data[key] = value;
    return this;
  }

  setMany(values: Partial<T>): Builder<T> {
    this.data = { ...this.data, ...values };
    return this;
  }

  build(): T {
    return this.data as T;
  }

  buildWith(defaults: T): T {
    return { ...defaults, ...this.data };
  }
}

export function createBuilder<T>(): Builder<T> {
  return new Builder<T>();
}

/**
 * Generic event emitter with type safety
 */
export class TypedEventEmitter<Events extends Record<string, unknown[]>> {
  private listeners: Map<keyof Events, Array<(...args: unknown[]) => void>> = new Map();

  on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(...args);
      }
    }
  }

  off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener as (...args: unknown[]) => void);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}