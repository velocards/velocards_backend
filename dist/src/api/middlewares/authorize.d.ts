import { Response, NextFunction } from 'express';
import { Permission } from '../../config/roles';
import { AuthRequest } from './auth';
/**
 * Authorization middleware factory
 * Checks if the authenticated user has the required permissions
 *
 * @param requiredPermissions - Single permission or array of permissions required
 * @param requireAll - If true, user must have ALL permissions. If false, ANY permission is sufficient
 * @returns Express middleware function
 */
export declare function authorize(requiredPermissions: Permission | Permission[], requireAll?: boolean): (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Shorthand middleware for admin-only routes
 */
export declare const adminOnly: (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Check if user owns the resource they're trying to access
 * This is for resource-based authorization (e.g., can only edit own profile)
 */
export declare function authorizeOwnership(resourceUserIdExtractor: (req: AuthRequest) => string | undefined): (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Combine multiple authorization checks
 * All checks must pass for the request to proceed
 */
export declare function combineAuthorizations(...authorizations: Array<(req: AuthRequest, res: Response, next: NextFunction) => void>): (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authorize.d.ts.map