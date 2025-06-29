import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        sub: string;
        email: string;
        role?: string;
        permissions?: string[];
    };
}
export declare class InvoiceController {
    /**
     * List user invoices
     * GET /api/v1/invoices
     */
    static list(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get specific invoice details
     * GET /api/v1/invoices/:id
     */
    static get(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Resend invoice email
     * POST /api/v1/invoices/:id/resend
     */
    static resend(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Generate invoice manually (Admin only)
     * POST /api/v1/admin/invoices/generate
     */
    static manualGenerate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Bulk generate invoices (Admin only)
     * POST /api/v1/admin/invoices/bulk-generate
     */
    static bulkGenerate(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get invoice statistics
     * GET /api/v1/invoices/stats
     */
    static stats(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Update invoice settings
     * PUT /api/v1/invoices/settings
     */
    static updateSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get invoice settings
     * GET /api/v1/invoices/settings
     */
    static getSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Download invoice PDF
     * GET /api/v1/invoices/:id/download
     */
    static downloadPDF(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Resend invoice email
     * POST /api/v1/invoices/:id/resend
     */
    static resendEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    /**
     * Generate PDF for invoice (manual trigger)
     * POST /api/v1/invoices/:id/generate-pdf
     */
    static generatePDF(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=invoiceController.d.ts.map