import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../../services/invoiceService';
import { sendSuccess } from '../../utils/responseFormatter';
import logger from '../../utils/logger';

// Use a type that matches existing patterns in the codebase
interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    role?: string;
    permissions?: string[];
  };
}

export class InvoiceController {
  /**
   * List user invoices
   * GET /api/v1/invoices
   */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const {
        status,
        type,
        from,
        to,
        page = '1',
        limit = '20'
      } = req.query;

      const filters = {
        status: status as any,
        type: type as any,
        from: from as string,
        to: to as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await InvoiceService.listInvoices(userId, filters);

      sendSuccess(res, {
        invoices: result.invoices,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific invoice details
   * GET /api/v1/invoices/:id
   */
  static async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const { id } = req.params;

      const invoice = await InvoiceService.getInvoice(id!, userId);
      const items = await InvoiceService.getInvoiceItems(id!);

      sendSuccess(res, {
        ...invoice,
        items
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Resend invoice email
   * POST /api/v1/invoices/:id/resend
   */
  static async resend(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const { id } = req.params;
      const { email } = req.body;

      // Get invoice to verify ownership
      await InvoiceService.getInvoice(id!, userId);

      // Get user email if not provided
      const recipientEmail = email || req.user!.email;

      // TODO: Implement actual email resending
      logger.info('Invoice email resend requested', {
        invoiceId: id,
        userId,
        email: recipientEmail
      });

      sendSuccess(res, {
        message: 'Invoice email will be resent',
        invoice_id: id,
        email: recipientEmail
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate invoice manually (Admin only)
   * POST /api/v1/admin/invoices/generate
   */
  static async manualGenerate(req: AuthRequest, res: Response, next: NextFunction) {
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

      sendSuccess(res, {
        message: 'Manual invoice generation not yet implemented',
        data: req.body
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk generate invoices (Admin only)
   * POST /api/v1/admin/invoices/bulk-generate
   */
  static async bulkGenerate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // const {
      //   userIds,
      //   type,
      //   period
      // } = req.body;

      // TODO: Implement bulk invoice generation
      // This would be used to generate invoices for multiple users at once

      sendSuccess(res, {
        message: 'Bulk invoice generation not yet implemented',
        data: req.body
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get invoice statistics
   * GET /api/v1/invoices/stats
   */
  static async stats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // const userId = req.user!.sub;
      const { period = 'month' } = req.query;

      // TODO: Implement invoice statistics
      // This would return summary data like total invoiced, pending, paid, etc.

      sendSuccess(res, {
        period,
        stats: {
          total_invoices: 0,
          total_amount: 0,
          paid_amount: 0,
          pending_amount: 0,
          overdue_amount: 0
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update invoice settings
   * PUT /api/v1/invoices/settings
   */
  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;
      const settings = req.body;

      // Update user settings via invoiceService
      const updatedSettings = await InvoiceService.updateUserSettings(userId, settings);

      sendSuccess(res, {
        message: 'Invoice settings updated',
        settings: updatedSettings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get invoice settings
   * GET /api/v1/invoices/settings
   */
  static async getSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub;

      // Get user settings from invoiceService
      const settings = await InvoiceService.getUserSettings(userId);
      
      sendSuccess(res, {
        settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download invoice PDF
   * GET /api/v1/invoices/:id/download
   */
  static async downloadPDF(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: invoiceId } = req.params;
      if (!invoiceId) {
        throw new Error('Invoice ID is required');
      }
      const userId = req.user!.sub;

      const { PDFService } = await import('../../services/pdfService');
      const { buffer, filename } = await PDFService.downloadInvoicePDF(invoiceId, userId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend invoice email
   * POST /api/v1/invoices/:id/resend
   */
  static async resendEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: invoiceId } = req.params;
      if (!invoiceId) {
        throw new Error('Invoice ID is required');
      }
      const userId = req.user!.sub;

      const { EmailService } = await import('../../services/emailService');
      await EmailService.resendInvoiceEmail(invoiceId, userId);

      sendSuccess(res, {
        message: 'Invoice email sent successfully',
        invoiceId
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate PDF for invoice (manual trigger)
   * POST /api/v1/invoices/:id/generate-pdf
   */
  static async generatePDF(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id: invoiceId } = req.params;
      if (!invoiceId) {
        throw new Error('Invoice ID is required');
      }
      const userId = req.user!.sub;

      // Verify user can access this invoice
      await InvoiceService.getInvoice(invoiceId, userId);

      const { PDFService } = await import('../../services/pdfService');
      const pdfUrl = await PDFService.generateInvoicePDF(invoiceId);

      sendSuccess(res, {
        message: 'PDF generated successfully',
        pdfUrl,
        invoiceId
      });
    } catch (error) {
      next(error);
    }
  }
}