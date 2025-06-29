import { Router } from 'express';
import { InvoiceController } from '../controllers/invoiceController';
import { authenticate } from '../middlewares/auth';
import { authorize } from '../middlewares/authorize';
import { validate } from '../middlewares/validate';
import { z } from 'zod';
import { supabase } from '../../config/database';
import { PERMISSIONS } from '../../config/roles';

const router = Router();

// Health check - no authentication required
router.get('/health', async (_req, res) => {
  try {
    // Check if invoice events table is accessible
    const { error } = await supabase
      .from('invoice_events')
      .select('count')
      .limit(1);

    const healthy = !error;

    res.json({
      success: true,
      data: {
        service: 'invoice-generator',
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: healthy ? 'connected' : 'disconnected'
        }
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Invoice service health check failed'
      }
    });
  }
});

// All other invoice routes require authentication
router.use(authenticate);

// Validation schemas
const listInvoicesSchema = z.object({
  query: z.object({
    status: z.enum(['draft', 'pending', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'failed']).optional(),
    type: z.enum(['card_transaction', 'crypto_deposit', 'crypto_withdrawal', 'monthly_fee', 
                  'card_creation_fee', 'deposit_fee', 'manual', 'consolidated']).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional()
  })
});

const resendInvoiceSchema = z.object({
  body: z.object({
    email: z.string().email().optional()
  })
});

const manualGenerateSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    type: z.enum(['manual', 'consolidated']),
    amount: z.number().positive(),
    description: z.string(),
    items: z.array(z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unit_price: z.number().positive(),
      tax_rate: z.number().min(0).max(100).optional()
    })).optional()
  })
});

const bulkGenerateSchema = z.object({
  body: z.object({
    userIds: z.array(z.string().uuid()),
    type: z.string(),
    period: z.string().optional()
  })
});

const updateSettingsSchema = z.object({
  body: z.object({
    auto_generate_pdf: z.boolean().optional(),
    auto_send_email: z.boolean().optional(),
    include_zero_amount: z.boolean().optional(),
    group_daily_fees: z.boolean().optional(),
    company_name: z.string().optional(),
    billing_address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
      country: z.string()
    }).optional(),
    tax_id: z.string().optional(),
    email_subject_template: z.string().optional(),
    email_body_template: z.string().optional(),
    cc_emails: z.array(z.string().email()).optional(),
    logo_url: z.string().url().optional(),
    footer_text: z.string().optional(),
    terms_and_conditions: z.string().optional()
  })
});

// User routes
router.get(
  '/',
  authorize(PERMISSIONS.INVOICES_READ),
  validate(listInvoicesSchema),
  InvoiceController.list
);

router.get(
  '/stats',
  authorize(PERMISSIONS.INVOICES_READ),
  InvoiceController.stats
);

router.get(
  '/settings',
  authorize(PERMISSIONS.INVOICES_READ),
  InvoiceController.getSettings
);

router.put(
  '/settings',
  authorize(PERMISSIONS.INVOICES_UPDATE),
  validate(updateSettingsSchema),
  InvoiceController.updateSettings
);

router.get(
  '/:id',
  authorize(PERMISSIONS.INVOICES_READ),
  InvoiceController.get
);

router.get(
  '/:id/download',
  authorize(PERMISSIONS.INVOICES_READ),
  InvoiceController.downloadPDF
);

router.post(
  '/:id/resend',
  authorize(PERMISSIONS.INVOICES_SEND),
  validate(resendInvoiceSchema),
  InvoiceController.resendEmail
);

router.post(
  '/:id/generate-pdf',
  authorize(PERMISSIONS.INVOICES_UPDATE),
  InvoiceController.generatePDF
);

// Admin routes
router.post(
  '/admin/generate',
  authorize(PERMISSIONS.INVOICES_CREATE),
  validate(manualGenerateSchema),
  InvoiceController.manualGenerate
);

router.post(
  '/admin/bulk-generate',
  authorize(PERMISSIONS.INVOICES_CREATE),
  validate(bulkGenerateSchema),
  InvoiceController.bulkGenerate
);

export default router;