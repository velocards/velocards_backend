"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoiceController_1 = require("../controllers/invoiceController");
const auth_1 = require("../middlewares/auth");
const authorize_1 = require("../middlewares/authorize");
const validate_1 = require("../middlewares/validate");
const zod_1 = require("zod");
const database_1 = require("../../config/database");
const roles_1 = require("../../config/roles");
const router = (0, express_1.Router)();
// Health check - no authentication required
router.get('/health', async (_req, res) => {
    try {
        // Check if invoice events table is accessible
        const { error } = await database_1.supabase
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
    }
    catch (error) {
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
router.use(auth_1.authenticate);
// Validation schemas
const listInvoicesSchema = zod_1.z.object({
    query: zod_1.z.object({
        status: zod_1.z.enum(['draft', 'pending', 'sent', 'viewed', 'paid', 'overdue', 'cancelled', 'failed']).optional(),
        type: zod_1.z.enum(['card_transaction', 'crypto_deposit', 'crypto_withdrawal', 'monthly_fee',
            'card_creation_fee', 'deposit_fee', 'manual', 'consolidated']).optional(),
        from: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        page: zod_1.z.string().regex(/^\d+$/).optional(),
        limit: zod_1.z.string().regex(/^\d+$/).optional()
    })
});
const resendInvoiceSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email().optional()
    })
});
const manualGenerateSchema = zod_1.z.object({
    body: zod_1.z.object({
        userId: zod_1.z.string().uuid(),
        type: zod_1.z.enum(['manual', 'consolidated']),
        amount: zod_1.z.number().positive(),
        description: zod_1.z.string(),
        items: zod_1.z.array(zod_1.z.object({
            description: zod_1.z.string(),
            quantity: zod_1.z.number().positive(),
            unit_price: zod_1.z.number().positive(),
            tax_rate: zod_1.z.number().min(0).max(100).optional()
        })).optional()
    })
});
const bulkGenerateSchema = zod_1.z.object({
    body: zod_1.z.object({
        userIds: zod_1.z.array(zod_1.z.string().uuid()),
        type: zod_1.z.string(),
        period: zod_1.z.string().optional()
    })
});
const updateSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        auto_generate_pdf: zod_1.z.boolean().optional(),
        auto_send_email: zod_1.z.boolean().optional(),
        include_zero_amount: zod_1.z.boolean().optional(),
        group_daily_fees: zod_1.z.boolean().optional(),
        company_name: zod_1.z.string().optional(),
        billing_address: zod_1.z.object({
            street: zod_1.z.string(),
            city: zod_1.z.string(),
            state: zod_1.z.string(),
            zip: zod_1.z.string(),
            country: zod_1.z.string()
        }).optional(),
        tax_id: zod_1.z.string().optional(),
        email_subject_template: zod_1.z.string().optional(),
        email_body_template: zod_1.z.string().optional(),
        cc_emails: zod_1.z.array(zod_1.z.string().email()).optional(),
        logo_url: zod_1.z.string().url().optional(),
        footer_text: zod_1.z.string().optional(),
        terms_and_conditions: zod_1.z.string().optional()
    })
});
// User routes
router.get('/', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_READ), (0, validate_1.validate)(listInvoicesSchema), invoiceController_1.InvoiceController.list);
router.get('/stats', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_READ), invoiceController_1.InvoiceController.stats);
router.get('/settings', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_READ), invoiceController_1.InvoiceController.getSettings);
router.put('/settings', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_UPDATE), (0, validate_1.validate)(updateSettingsSchema), invoiceController_1.InvoiceController.updateSettings);
router.get('/:id', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_READ), invoiceController_1.InvoiceController.get);
router.get('/:id/download', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_READ), invoiceController_1.InvoiceController.downloadPDF);
router.post('/:id/resend', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_SEND), (0, validate_1.validate)(resendInvoiceSchema), invoiceController_1.InvoiceController.resendEmail);
router.post('/:id/generate-pdf', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_UPDATE), invoiceController_1.InvoiceController.generatePDF);
// Admin routes
router.post('/admin/generate', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_CREATE), (0, validate_1.validate)(manualGenerateSchema), invoiceController_1.InvoiceController.manualGenerate);
router.post('/admin/bulk-generate', (0, authorize_1.authorize)(roles_1.PERMISSIONS.INVOICES_CREATE), (0, validate_1.validate)(bulkGenerateSchema), invoiceController_1.InvoiceController.bulkGenerate);
exports.default = router;
//# sourceMappingURL=invoiceRoutes.js.map