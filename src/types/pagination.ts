/**
 * Pagination Types
 * Defines TypeScript types for consistent pagination across all endpoints
 */

/**
 * Standard pagination request parameters
 * Compatible with existing request format
 */
export interface PaginationRequest {
  pagination?: {
    page: number;
    limit: number;
  };
}

/**
 * Standard pagination response metadata
 * Compatible with existing response format
 */
export interface PaginationMetadata {
  total: number;
  page: number;
  pages: number;
  limit?: number;
}

/**
 * Cursor-based pagination request
 * Compatible with Story 3.2.4 cursor pagination
 */
export interface CursorPaginationRequest {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/**
 * Cursor-based pagination page info
 * Compatible with relay-style connections
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount?: number;
}

/**
 * Edge wrapper for cursor pagination
 */
export interface Edge<T> {
  node: T;
  cursor: string;
}

/**
 * Connection wrapper for cursor pagination
 */
export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
}

/**
 * Paginated result wrapper for repositories
 */
export interface PaginatedResult<T> {
  items: T[];
  metadata: PaginationMetadata;
}

/**
 * Cursor paginated result wrapper for repositories
 */
export interface CursorPaginatedResult<T> {
  connection: Connection<T>;
}

/**
 * Pagination options for repository methods
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

/**
 * Cursor pagination options for repository methods
 */
export interface CursorPaginationOptions {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

/**
 * Calculate pagination metadata
 */
export function calculatePaginationMetadata(
  total: number,
  page: number,
  limit: number
): PaginationMetadata {
  const pages = Math.ceil(total / limit);
  
  return {
    total,
    page: Math.min(page, pages || 1),
    pages,
    limit
  };
}

/**
 * Calculate offset from page and limit
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(
  page?: number,
  limit?: number
): { page: number; limit: number } {
  const validPage = Math.max(1, page || 1);
  const validLimit = Math.min(100, Math.max(1, limit || 20));
  
  return {
    page: validPage,
    limit: validLimit
  };
}

/**
 * Encode cursor for cursor pagination
 */
export function encodeCursor(data: any): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode cursor for cursor pagination
 */
export function decodeCursor(cursor: string): any {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch {
    throw new Error('Invalid cursor');
  }
}

/**
 * Create connection from items
 */
export function createConnection<T>(
  items: T[],
  options: {
    getCursor: (item: T) => string;
    totalCount?: number;
    hasMore?: boolean;
  }
): Connection<T> {
  const edges = items.map(item => ({
    node: item,
    cursor: options.getCursor(item)
  }));

  const firstEdge = edges[0];
  const lastEdge = edges[edges.length - 1];
  const startCursor = firstEdge?.cursor;
  const endCursor = lastEdge?.cursor;
  
  return {
    edges,
    pageInfo: {
      hasNextPage: options.hasMore || false,
      hasPreviousPage: false,
      ...(startCursor && { startCursor }),
      ...(endCursor && { endCursor }),
      ...(options.totalCount !== undefined && { totalCount: options.totalCount })
    }
  };
}