import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

/**
 * API Versioning Middleware
 * Implements URL-based versioning strategy with v1/v2 support
 */

export interface VersionedRequest extends Request {
  apiVersion?: string;
  isLegacyVersion?: boolean;
  deprecationWarnings?: string[];
}

/**
 * API version configuration
 */
export const API_VERSIONS = {
  v1: {
    version: 'v1',
    deprecated: false,
    deprecationDate: undefined,
    sunsetDate: undefined, // Will be set to 90 days after v2 launch
    description: 'Original API version'
  },
  v2: {
    version: 'v2',
    deprecated: false,
    deprecationDate: undefined,
    sunsetDate: undefined,
    description: 'Enhanced API with standardized responses'
  }
};

/**
 * Default API version
 */
export const DEFAULT_VERSION = 'v1';

/**
 * Supported API versions
 */
export const SUPPORTED_VERSIONS = Object.keys(API_VERSIONS);

/**
 * Extract API version from request
 */
export function extractApiVersion(req: Request): string {
  // Check URL path for version
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  // Check Accept header for version
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.velocards\.(v\d+)\+json/);
    if (versionMatch) {
      return versionMatch[1];
    }
  }
  
  // Check custom header for version
  const versionHeader = req.headers['x-api-version'];
  if (versionHeader && typeof versionHeader === 'string') {
    return versionHeader;
  }
  
  // Check query parameter for version
  const versionQuery = req.query.apiVersion || req.query.version;
  if (versionQuery && typeof versionQuery === 'string') {
    return versionQuery;
  }
  
  // Default to v1 for backward compatibility
  return DEFAULT_VERSION;
}

/**
 * API versioning middleware
 */
export function versioningMiddleware(req: Request, res: Response, next: NextFunction): void {
  const versionedReq = req as VersionedRequest;
  
  // Extract version from request
  const version = extractApiVersion(req);
  versionedReq.apiVersion = version;
  
  // Check if version is supported
  if (!SUPPORTED_VERSIONS.includes(version)) {
    res.status(400).json({
      success: false,
      error: `API version '${version}' is not supported`,
      supportedVersions: SUPPORTED_VERSIONS
    });
    return;
  }
  
  // Add version info to response headers
  res.setHeader('X-API-Version', version);
  res.setHeader('X-Supported-Versions', SUPPORTED_VERSIONS.join(', '));
  
  // Check for deprecation
  const versionConfig = API_VERSIONS[version as keyof typeof API_VERSIONS];
  if (versionConfig.deprecated) {
    versionedReq.deprecationWarnings = versionedReq.deprecationWarnings || [];
    versionedReq.deprecationWarnings.push(
      `API version ${version} is deprecated and will be removed on ${versionConfig.sunsetDate}`
    );
    
    // Add deprecation headers
    res.setHeader('X-API-Deprecated', 'true');
    if (versionConfig.sunsetDate) {
      res.setHeader('X-API-Sunset-Date', versionConfig.sunsetDate.toString());
    }
    res.setHeader('X-API-Deprecation-Info', 
      `Please migrate to a newer API version. See documentation for migration guide.`
    );
  }
  
  // Mark if using legacy version
  versionedReq.isLegacyVersion = version === 'v1';
  
  // Log API version usage for monitoring
  logger.info('API request', {
    version,
    path: req.path,
    method: req.method,
    deprecated: versionConfig.deprecated,
    ip: req.ip
  });
  
  next();
}

/**
 * Version-specific route handler
 */
export function versionRoute(versions: { [key: string]: any }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const versionedReq = req as VersionedRequest;
    const version = versionedReq.apiVersion || DEFAULT_VERSION;
    
    const handler = versions[version] || versions.default;
    
    if (!handler) {
      res.status(501).json({
        success: false,
        error: `This endpoint is not implemented for API version ${version}`
      });
      return;
    }
    
    handler(req, res, next);
  };
}

/**
 * Response transformer for v1 to v2 adapter
 */
export function transformResponseForVersion(
  data: any,
  fromVersion: string,
  toVersion: string
): any {
  // Transform v2 response to v1 format
  if (fromVersion === 'v2' && toVersion === 'v1') {
    // V2 has additional metadata that v1 doesn't need
    if (data.timestamp !== undefined) delete data.timestamp;
    if (data.correlationId !== undefined) delete data.correlationId;
    if (data.version !== undefined) delete data.version;
    
    // Ensure v1 format compliance
    return {
      success: data.success,
      data: data.data,
      error: data.error
    };
  }
  
  // Transform v1 response to v2 format
  if (fromVersion === 'v1' && toVersion === 'v2') {
    return {
      ...data,
      timestamp: new Date().toISOString(),
      version: 'v2'
    };
  }
  
  // No transformation needed
  return data;
}

/**
 * Create version-aware router
 */
export function createVersionedRouter(express: any) {
  const v1Router = express.Router();
  const v2Router = express.Router();
  
  // Apply version-specific middleware
  v1Router.use((req: Request, res: Response, next: NextFunction) => {
    (req as VersionedRequest).apiVersion = 'v1';
    next();
  });
  
  v2Router.use((req: Request, res: Response, next: NextFunction) => {
    (req as VersionedRequest).apiVersion = 'v2';
    next();
  });
  
  return {
    v1: v1Router,
    v2: v2Router
  };
}

/**
 * Deprecation notice middleware
 */
export function deprecationNotice(
  version: string,
  sunsetDate: Date,
  alternativeVersion: string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const versionedReq = req as VersionedRequest;
    
    if (versionedReq.apiVersion === version) {
      versionedReq.deprecationWarnings = versionedReq.deprecationWarnings || [];
      versionedReq.deprecationWarnings.push(
        `This endpoint is deprecated in ${version} and will be removed on ${sunsetDate.toISOString()}. ` +
        `Please use ${alternativeVersion} instead.`
      );
      
      res.setHeader('X-API-Deprecation-Warning', 
        `Deprecated endpoint. Sunset date: ${sunsetDate.toISOString()}`
      );
    }
    
    next();
  };
}

/**
 * Version compatibility checker
 */
export function checkVersionCompatibility(
  requiredVersion: string,
  message?: string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const versionedReq = req as VersionedRequest;
    const currentVersion = versionedReq.apiVersion || DEFAULT_VERSION;
    
    if (currentVersion < requiredVersion) {
      res.status(400).json({
        success: false,
        error: message || `This feature requires API version ${requiredVersion} or higher`,
        currentVersion,
        requiredVersion
      });
      return;
    }
    
    next();
  };
}