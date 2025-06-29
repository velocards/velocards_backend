import { Request, Response, NextFunction } from 'express';
import { UserRole, Permission } from '../../config/roles';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        sub: string;
        email: string;
        sessionId: string;
        role?: UserRole;
        permissions?: Permission[];
    };
}
export declare function authenticate(req: AuthRequest, _res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map