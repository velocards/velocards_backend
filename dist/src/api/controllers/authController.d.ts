import { Request, Response, NextFunction } from 'express';
import { RegisterInput, LoginInput, RefreshTokenInput } from '../validators/authValidators';
import { AuthRequest } from '../middlewares/auth';
export declare class AuthController {
    static register(req: Request<{}, {}, RegisterInput>, res: Response, next: NextFunction): Promise<void>;
    static login(req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction): Promise<void>;
    static refreshToken(req: Request<{}, {}, RefreshTokenInput>, res: Response, next: NextFunction): Promise<void>;
    static logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map