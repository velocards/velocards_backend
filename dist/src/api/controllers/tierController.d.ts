import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        sub: string;
        email: string;
        role: string;
    };
}
export declare class TierController {
    /**
     * Get all available tiers
     */
    static getAllTiers(_req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get current user's tier information
     */
    static getUserTier(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's tier history
     */
    static getUserTierHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get user's fee summary
     */
    static getUserFees(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Calculate fees for a specific action
     */
    static calculateFees(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Process pending monthly fees
     */
    static processMonthlyFees(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get upcoming monthly renewal information
     */
    static getUpcomingRenewal(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get detailed monthly fee breakdown
     */
    static getMonthlyFeeBreakdown(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=tierController.d.ts.map