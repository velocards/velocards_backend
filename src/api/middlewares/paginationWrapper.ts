import { Request, Response, NextFunction } from 'express';
import { 
  PaginationRequest,
  PaginationMetadata,
  CursorPaginationRequest,
  validatePaginationParams,
  calculateOffset,
  calculatePaginationMetadata,
  encodeCursor,
  decodeCursor
} from '../../types/pagination';
import { ExtendedResponse } from './responseWrapper';

/**
 * Pagination wrapper utilities
 * Provides consistent pagination handling across all endpoints
 */

export interface ExtendedRequest extends Request {
  pagination?: {
    page: number;
    limit: number;
    offset: number;
  };
  cursorPagination?: {
    first?: number;
    after?: string;
    last?: number;
    before?: string;
  };
}

/**
 * Parse standard pagination parameters from request
 */
export function parsePaginationParams(req: ExtendedRequest): void {
  const { page, limit } = req.query;
  const { pagination } = req.body as PaginationRequest;
  
  // Priority: body > query > defaults
  const pageNumber = pagination?.page || (page ? parseInt(page as string, 10) : 1);
  const pageLimit = pagination?.limit || (limit ? parseInt(limit as string, 10) : 20);
  
  const validated = validatePaginationParams(pageNumber, pageLimit);
  
  req.pagination = {
    page: validated.page,
    limit: validated.limit,
    offset: calculateOffset(validated.page, validated.limit)
  };
}

/**
 * Parse cursor pagination parameters from request
 */
export function parseCursorPaginationParams(req: ExtendedRequest): void {
  const { first, after, last, before } = req.query;
  const cursorPagination = req.body as CursorPaginationRequest;
  
  req.cursorPagination = {
    first: cursorPagination?.first || (first ? parseInt(first as string, 10) : undefined),
    after: cursorPagination?.after || (after as string) || undefined,
    last: cursorPagination?.last || (last ? parseInt(last as string, 10) : undefined),
    before: cursorPagination?.before || (before as string) || undefined
  };
}

/**
 * Pagination middleware
 * Adds pagination parsing to request object
 */
export function paginationMiddleware(type: 'standard' | 'cursor' | 'both' = 'standard') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const extendedReq = req as ExtendedRequest;
    
    if (type === 'standard' || type === 'both') {
      parsePaginationParams(extendedReq);
    }
    
    if (type === 'cursor' || type === 'both') {
      parseCursorPaginationParams(extendedReq);
    }
    
    next();
  };
}

/**
 * Create paginated response helper
 */
export function createPaginatedResponse<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  limit: number,
  statusCode: number = 200
): void {
  const extendedRes = res as ExtendedResponse;
  const metadata = calculatePaginationMetadata(total, page, limit);
  
  extendedRes.sendPaginated(items, metadata, statusCode);
}

/**
 * Create cursor paginated response helper
 */
export function createCursorPaginatedResponse<T>(
  res: Response,
  items: T[],
  options: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    getCursor: (item: T) => string;
    totalCount?: number;
  },
  statusCode: number = 200
): void {
  const extendedRes = res as ExtendedResponse;
  
  const edges = items.map(item => ({
    node: item,
    cursor: options.getCursor(item)
  }));
  
  const pageInfo = {
    hasNextPage: options.hasNextPage,
    hasPreviousPage: options.hasPreviousPage,
    startCursor: edges.length > 0 ? edges[0].cursor : undefined,
    endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : undefined,
    totalCount: options.totalCount
  };
  
  extendedRes.sendCursorPaginated(edges, pageInfo, statusCode);
}

/**
 * Pagination utility functions
 */
export class PaginationUtils {
  /**
   * Apply pagination to array
   */
  static paginateArray<T>(
    items: T[],
    page: number,
    limit: number
  ): { items: T[]; metadata: PaginationMetadata } {
    const validated = validatePaginationParams(page, limit);
    const offset = calculateOffset(validated.page, validated.limit);
    const paginatedItems = items.slice(offset, offset + validated.limit);
    const metadata = calculatePaginationMetadata(items.length, validated.page, validated.limit);
    
    return {
      items: paginatedItems,
      metadata
    };
  }
  
  /**
   * Create cursor from item
   */
  static createCursor<T>(item: T, fields: (keyof T)[]): string {
    const cursorData: any = {};
    for (const field of fields) {
      cursorData[field as string] = item[field];
    }
    return encodeCursor(cursorData);
  }
  
  /**
   * Parse cursor to get field values
   */
  static parseCursor(cursor: string): any {
    return decodeCursor(cursor);
  }
  
  /**
   * Check if pagination is requested
   */
  static isPaginationRequested(req: Request): boolean {
    const { page, limit } = req.query;
    const { pagination } = req.body as PaginationRequest;
    
    return !!(page || limit || pagination);
  }
  
  /**
   * Check if cursor pagination is requested
   */
  static isCursorPaginationRequested(req: Request): boolean {
    const { first, after, last, before } = req.query;
    const cursorPagination = req.body as CursorPaginationRequest;
    
    return !!(first || after || last || before || 
              cursorPagination?.first || cursorPagination?.after ||
              cursorPagination?.last || cursorPagination?.before);
  }
  
  /**
   * Convert standard pagination to SQL LIMIT/OFFSET
   */
  static toSqlPagination(page: number, limit: number): { limit: number; offset: number } {
    const validated = validatePaginationParams(page, limit);
    return {
      limit: validated.limit,
      offset: calculateOffset(validated.page, validated.limit)
    };
  }
  
  /**
   * Calculate if there are more pages
   */
  static hasMorePages(total: number, page: number, limit: number): boolean {
    const totalPages = Math.ceil(total / limit);
    return page < totalPages;
  }
}