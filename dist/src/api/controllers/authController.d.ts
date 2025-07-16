import { Request, Response, NextFunction } from 'express';
import { RegisterInput, LoginInput, RefreshTokenInput, ForgotPasswordInput, ResetPasswordInput } from '../validators/authValidators';
import { AuthRequest } from '../middlewares/auth';
export declare class AuthController {
    static register(req: Request<{}, {}, RegisterInput>, res: Response, next: NextFunction): Promise<void>;
    static login(req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction): Promise<void>;
    static refreshToken(req: Request<{}, {}, RefreshTokenInput>, res: Response, next: NextFunction): Promise<void>;
    static logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static forgotPassword(req: Request<{}, {}, ForgotPasswordInput>, res: Response, _next: NextFunction): Promise<void>;
    static resetPassword(req: Request<{}, {}, ResetPasswordInput>, res: Response, next: NextFunction): Promise<void>;
    static validateResetToken(req: Request<{
        token: string;
    }>, res: Response, next: NextFunction): Promise<void>;
    static verifyEmail(req: Request<{}, {}, {
        token: string;
    }>, res: Response, next: NextFunction): Promise<void>;
    static resendVerificationEmail(req: Request<{}, {}, {
        email: string;
    }>, res: Response, _next: NextFunction): Promise<void>;
    static checkVerificationStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static googleAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
    static googleCallback(req: Request, res: Response): Promise<void>;
    static linkGoogleAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static unlinkGoogleAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static getLinkedProviders(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    static checkCaptchaRequired(req: Request<{
        action: string;
    }>, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map