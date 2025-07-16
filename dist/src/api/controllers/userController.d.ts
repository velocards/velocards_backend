import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth';
export declare class UserController {
    /**
     * Get authenticated user's profile
     */
    static getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update authenticated user's profile
     */
    static updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's current balance
     */
    static getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's available balance with breakdown
     */
    static getAvailableBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's balance history
     */
    static getBalanceHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update user settings
     */
    static updateSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get comprehensive user statistics
     * GET /api/v1/users/statistics
     */
    static getUserStatistics(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=userController.d.ts.map