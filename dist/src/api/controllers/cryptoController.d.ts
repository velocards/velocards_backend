import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        sub: string;
        email: string;
        role: string;
        permissions: string[];
    };
    id?: string;
}
export declare class CryptoController {
    /**
     * Create a deposit order
     * POST /api/v1/crypto/deposit/order
     */
    static createDepositOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get deposit history
     * GET /api/v1/crypto/deposit/history
     */
    static getDepositHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get order status
     * GET /api/v1/crypto/orders/:orderId
     */
    static getOrderStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Process xMoney webhook
     * POST /api/v1/webhooks/xmoney
     * Note: This endpoint should not require authentication
     */
    static processWebhook(req: Request, res: Response, _next: NextFunction): Promise<void>;
}
//# sourceMappingURL=cryptoController.d.ts.map