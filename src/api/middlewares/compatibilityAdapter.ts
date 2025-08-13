import { Request, Response, NextFunction } from 'express';
import { VersionedRequest } from './versioningMiddleware';
import logger from '../../utils/logger';

/**
 * Backward Compatibility Adapter
 * Ensures v1 clients continue working with v2 responses
 */

/**
 * Response adapter middleware
 * Transforms v2 responses to v1 format for legacy clients
 */
export function responseAdapter(req: Request, res: Response, next: NextFunction): void {
  const versionedReq = req as VersionedRequest;
  const originalJson = res.json;
  
  // Only apply adapter for v1 endpoints receiving v2 responses
  if (versionedReq.apiVersion !== 'v1') {
    next();
    return;
  }
  
  // Override json method to transform response
  res.json = function(data: any) {
    // Transform v2 response format to v1
    const transformedData = transformV2ToV1Response(data);
    
    // Add deprecation warnings if any
    if (versionedReq.deprecationWarnings && versionedReq.deprecationWarnings.length > 0) {
      res.setHeader('X-Deprecation-Warnings', versionedReq.deprecationWarnings.join('; '));
    }
    
    // Log transformation for monitoring
    logger.debug('Response transformation applied', {
      from: 'v2',
      to: 'v1',
      path: req.path,
      method: req.method
    });
    
    return originalJson.call(this, transformedData);
  };
  
  next();
}

/**
 * Request adapter middleware
 * Transforms v1 requests to v2 format for new handlers
 */
export function requestAdapter(req: Request, _res: Response, next: NextFunction): void {
  const versionedReq = req as VersionedRequest;
  
  // Only apply adapter for v1 requests to v2 handlers
  if (versionedReq.apiVersion !== 'v1') {
    next();
    return;
  }
  
  // Transform request body if present
  if (req.body) {
    req.body = transformV1ToV2Request(req.body, req.path);
  }
  
  // Transform query parameters
  if (req.query) {
    req.query = transformV1ToV2Query(req.query);
  }
  
  next();
}

/**
 * Transform v2 response to v1 format
 */
function transformV2ToV1Response(data: any): any {
  // Handle null/undefined
  if (!data) return data;
  
  // Remove v2-specific fields
  const transformed = { ...data };
  delete transformed.timestamp;
  delete transformed.correlationId;
  delete transformed.version;
  
  // Ensure v1 format structure
  if ('success' in transformed) {
    // Already in correct format, just cleaned
    return {
      success: transformed.success,
      data: transformed.data,
      error: transformed.error
    };
  }
  
  // Wrap non-standard responses
  return {
    success: true,
    data: transformed
  };
}

/**
 * Transform v1 request to v2 format
 */
function transformV1ToV2Request(body: any, _path: string): any {
  // Handle pagination transformation
  if (body.page !== undefined || body.limit !== undefined) {
    return {
      ...body,
      pagination: {
        page: body.page || 1,
        limit: body.limit || 20
      }
    };
  }
  
  // No transformation needed
  return body;
}

/**
 * Transform v1 query parameters to v2 format
 */
function transformV1ToV2Query(query: any): any {
  const transformed = { ...query };
  
  // Transform pagination params
  if (query.page || query.limit) {
    // V2 uses same query param names, no transformation needed
  }
  
  // Transform sort params (v1 uses 'sort', v2 uses 'orderBy')
  if (query.sort && !query.orderBy) {
    transformed.orderBy = query.sort;
    delete transformed.sort;
  }
  
  // Transform direction params (v1 uses 'order', v2 uses 'orderDirection')
  if (query.order && !query.orderDirection) {
    transformed.orderDirection = query.order;
    delete transformed.order;
  }
  
  return transformed;
}

/**
 * Migration helper middleware
 * Logs usage patterns to help with migration planning
 */
export function migrationMonitor(req: Request, _res: Response, next: NextFunction): void {
  const versionedReq = req as VersionedRequest;
  
  if (versionedReq.apiVersion === 'v1') {
    // Log v1 usage for migration tracking
    logger.info('V1 API usage', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
    
    // Track specific endpoints still using v1
    trackV1Usage(req.path, req.method);
  }
  
  next();
}

/**
 * Track v1 endpoint usage
 */
const v1UsageStats = new Map<string, number>();

function trackV1Usage(path: string, method: string): void {
  const key = `${method}:${path}`;
  const count = v1UsageStats.get(key) || 0;
  v1UsageStats.set(key, count + 1);
  
  // Log high-usage v1 endpoints periodically
  if (count > 0 && count % 100 === 0) {
    logger.warn('High v1 endpoint usage detected', {
      endpoint: key,
      count,
      message: 'Consider prioritizing migration for this endpoint'
    });
  }
}

/**
 * Get v1 usage statistics
 */
export function getV1UsageStats(): Array<{ endpoint: string; count: number }> {
  return Array.from(v1UsageStats.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compatibility test middleware
 * Validates that responses maintain v1 structure
 */
export function compatibilityValidator(req: Request, res: Response, next: NextFunction): void {
  const versionedReq = req as VersionedRequest;
  
  if (versionedReq.apiVersion !== 'v1') {
    next();
    return;
  }
  
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Validate v1 response structure
    if (!isValidV1Response(data)) {
      logger.error('Invalid v1 response structure', {
        path: req.path,
        method: req.method,
        response: JSON.stringify(data).substring(0, 200)
      });
      
      // Ensure valid v1 structure
      data = {
        success: false,
        error: 'Internal server error'
      };
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Validate v1 response structure
 */
function isValidV1Response(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  
  // Must have success field
  if (typeof data.success !== 'boolean') return false;
  
  // If success is true, should have data field
  // If success is false, should have error field
  if (data.success && data.data === undefined) return false;
  if (!data.success && !data.error) return false;
  
  // Should not have v2-specific fields
  if (data.timestamp || data.correlationId || data.version) return false;
  
  return true;
}

/**
 * Create compatibility layer for specific endpoint
 */
export function createEndpointAdapter(
  v1Handler: any,
  v2Handler: any
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const versionedReq = req as VersionedRequest;
    
    if (versionedReq.apiVersion === 'v1') {
      // Use v1 handler with response adapter
      v1Handler(req, res, next);
    } else {
      // Use v2 handler
      v2Handler(req, res, next);
    }
  };
}

/**
 * Batch compatibility adapter for multiple endpoints
 */
export class CompatibilityRouter {
  private routes: Map<string, { v1: any; v2: any }> = new Map();
  
  /**
   * Register versioned handlers for a route
   */
  register(path: string, v1Handler: any, v2Handler: any): void {
    this.routes.set(path, { v1: v1Handler, v2: v2Handler });
  }
  
  /**
   * Get appropriate handler based on version
   */
  getHandler(path: string, version: string): any {
    const handlers = this.routes.get(path);
    if (!handlers) return null;
    
    return version === 'v1' ? handlers.v1 : handlers.v2;
  }
  
  /**
   * Apply compatibility routing
   */
  apply(router: any): void {
    for (const [path, handlers] of this.routes) {
      router.all(path, createEndpointAdapter(handlers.v1, handlers.v2));
    }
  }
}