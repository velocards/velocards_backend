"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceController = void 0;
const invoiceService_1 = require("../../services/invoiceService");
const responseFormatter_1 = require("../../utils/responseFormatter");
const logger_1 = __importDefault(require("../../utils/logger"));
class InvoiceController {
    /**
     * List user invoices
     * GET /api/v1/invoices
     */
    static async list(req, res, next) {
        try {
            const userId = req.user.sub;
            const { status, type, from, to, page = '1', limit = '20' } = req.query;
            const filters = {
                status: status,
                type: type,
                from: from,
                to: to,
                page: parseInt(page),
                limit: parseInt(limit)
            };
            const result = await invoiceService_1.InvoiceService.listInvoices(userId, filters);
            (0, responseFormatter_1.sendSuccess)(res, {
                invoices: result.invoices,
                pagination: {
                    page: filters.page,
                    limit: filters.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / filters.limit)
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get specific invoice details
     * GET /api/v1/invoices/:id
     */
    static async get(req, res, next) {
        try {
            const userId = req.user.sub;
            const { id } = req.params;
            const invoice = await invoiceService_1.InvoiceService.getInvoice(id, userId);
            const items = await invoiceService_1.InvoiceService.getInvoiceItems(id);
            (0, responseFormatter_1.sendSuccess)(res, {
                ...invoice,
                items
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Resend invoice email
     * POST /api/v1/invoices/:id/resend
     */
    static async resend(req, res, next) {
        try {
            const userId = req.user.sub;
            const { id } = req.params;
            const { email } = req.body;
            // Get invoice to verify ownership
            await invoiceService_1.InvoiceService.getInvoice(id, userId);
            // Get user email if not provided
            const recipientEmail = email || req.user.email;
            // TODO: Implement actual email resending
            logger_1.default.info('Invoice email resend requested', {
                invoiceId: id,
                userId,
                email: recipientEmail
            });
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Invoice email will be resent',
                invoice_id: id,
                email: recipientEmail
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Generate invoice manually (Admin only)
     * POST /api/v1/admin/invoices/generate
     */
    static async manualGenerate(req, res, next) {
        try {
            // const {
            //   userId,
            //   type,
            //   amount,
            //   description,
            //   items
            // } = req.body;
            // TODO: Implement manual invoice generation
            // This would be used by admins to create custom invoices
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Manual invoice generation not yet implemented',
                data: req.body
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Bulk generate invoices (Admin only)
     * POST /api/v1/admin/invoices/bulk-generate
     */
    static async bulkGenerate(req, res, next) {
        try {
            // const {
            //   userIds,
            //   type,
            //   period
            // } = req.body;
            // TODO: Implement bulk invoice generation
            // This would be used to generate invoices for multiple users at once
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Bulk invoice generation not yet implemented',
                data: req.body
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get invoice statistics
     * GET /api/v1/invoices/stats
     */
    static async stats(req, res, next) {
        try {
            // const userId = req.user!.sub;
            const { period = 'month' } = req.query;
            // TODO: Implement invoice statistics
            // This would return summary data like total invoiced, pending, paid, etc.
            (0, responseFormatter_1.sendSuccess)(res, {
                period,
                stats: {
                    total_invoices: 0,
                    total_amount: 0,
                    paid_amount: 0,
                    pending_amount: 0,
                    overdue_amount: 0
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update invoice settings
     * PUT /api/v1/invoices/settings
     */
    static async updateSettings(req, res, next) {
        try {
            const userId = req.user.sub;
            const settings = req.body;
            // Update user settings via invoiceService
            const updatedSettings = await invoiceService_1.InvoiceService.updateUserSettings(userId, settings);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Invoice settings updated',
                settings: updatedSettings
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get invoice settings
     * GET /api/v1/invoices/settings
     */
    static async getSettings(req, res, next) {
        try {
            const userId = req.user.sub;
            // Get user settings from invoiceService
            const settings = await invoiceService_1.InvoiceService.getUserSettings(userId);
            (0, responseFormatter_1.sendSuccess)(res, {
                settings
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Download invoice PDF
     * GET /api/v1/invoices/:id/download
     */
    static async downloadPDF(req, res, next) {
        try {
            const { id: invoiceId } = req.params;
            if (!invoiceId) {
                throw new Error('Invoice ID is required');
            }
            const userId = req.user.sub;
            const { PDFService } = await Promise.resolve().then(() => __importStar(require('../../services/pdfService')));
            const { buffer, filename } = await PDFService.downloadInvoicePDF(invoiceId, userId);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Resend invoice email
     * POST /api/v1/invoices/:id/resend
     */
    static async resendEmail(req, res, next) {
        try {
            const { id: invoiceId } = req.params;
            if (!invoiceId) {
                throw new Error('Invoice ID is required');
            }
            const userId = req.user.sub;
            const { EmailService } = await Promise.resolve().then(() => __importStar(require('../../services/emailService')));
            await EmailService.resendInvoiceEmail(invoiceId, userId);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'Invoice email sent successfully',
                invoiceId
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Generate PDF for invoice (manual trigger)
     * POST /api/v1/invoices/:id/generate-pdf
     */
    static async generatePDF(req, res, next) {
        try {
            const { id: invoiceId } = req.params;
            if (!invoiceId) {
                throw new Error('Invoice ID is required');
            }
            const userId = req.user.sub;
            // Verify user can access this invoice
            await invoiceService_1.InvoiceService.getInvoice(invoiceId, userId);
            const { PDFService } = await Promise.resolve().then(() => __importStar(require('../../services/pdfService')));
            const pdfUrl = await PDFService.generateInvoicePDF(invoiceId);
            (0, responseFormatter_1.sendSuccess)(res, {
                message: 'PDF generated successfully',
                pdfUrl,
                invoiceId
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.InvoiceController = InvoiceController;
//# sourceMappingURL=invoiceController.js.map