"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookPayloadSchema = exports.getOrderStatusSchema = exports.getExchangeRatesSchema = exports.createWithdrawalSchema = exports.getDepositHistorySchema = exports.createDepositOrderSchema = void 0;
const zod_1 = require("zod");
const env_1 = require("../../config/env");
// Common crypto currencies (mock list)
const SUPPORTED_CRYPTO_CURRENCIES = [
    'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'SOL'
];
// Create deposit order schema
exports.createDepositOrderSchema = zod_1.z.object({
    body: zod_1.z.object({
        amount: zod_1.z.number()
            .positive('Amount must be positive')
            .min(env_1.crypto.minDepositAmount, `Minimum deposit amount is ${env_1.crypto.minDepositAmount}`)
            .max(env_1.crypto.maxDepositAmount, `Maximum deposit amount is ${env_1.crypto.maxDepositAmount}`),
        currency: zod_1.z.literal('USD', {
            errorMap: () => ({ message: 'Only USD currency is supported' })
        })
    })
});
// Get deposit history schema
exports.getDepositHistorySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
        limit: zod_1.z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
        status: zod_1.z.enum(['pending', 'confirming', 'completed', 'failed']).optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional()
    }).refine(data => {
        if (data.page && data.page < 1)
            return false;
        if (data.limit && (data.limit < 1 || data.limit > 100))
            return false;
        return true;
    }, {
        message: 'Invalid pagination parameters'
    })
});
// Create withdrawal schema
exports.createWithdrawalSchema = zod_1.z.object({
    body: zod_1.z.object({
        amount: zod_1.z.number()
            .positive('Amount must be positive')
            .min(0.001, 'Amount too small'),
        currency: zod_1.z.enum(SUPPORTED_CRYPTO_CURRENCIES, {
            errorMap: () => ({ message: 'Unsupported cryptocurrency' })
        }),
        address: zod_1.z.string()
            .min(10, 'Invalid address')
            .max(200, 'Address too long'),
        network: zod_1.z.string().optional()
    })
});
// Get exchange rates schema
exports.getExchangeRatesSchema = zod_1.z.object({
    query: zod_1.z.object({
        from: zod_1.z.enum(SUPPORTED_CRYPTO_CURRENCIES).optional(),
        to: zod_1.z.literal('USD').optional()
    }).refine(data => {
        // If one is provided, both must be provided
        if ((data.from && !data.to) || (!data.from && data.to)) {
            return false;
        }
        return true;
    }, {
        message: 'Both "from" and "to" currencies must be provided for specific rate'
    })
});
// Get order status schema
exports.getOrderStatusSchema = zod_1.z.object({
    params: zod_1.z.object({
        orderId: zod_1.z.string().uuid('Invalid order ID format')
    })
});
// Webhook payload schema (based on xMoney documentation)
exports.webhookPayloadSchema = zod_1.z.object({
    body: zod_1.z.object({
        event_type: zod_1.z.enum(['ORDER.PAYMENT.DETECTED', 'ORDER.PAYMENT.RECEIVED', 'ORDER.PAYMENT.CANCELLED']),
        resource: zod_1.z.object({
            reference: zod_1.z.string(),
            amount: zod_1.z.string(),
            currency: zod_1.z.string()
        }),
        signature: zod_1.z.string(),
        state: zod_1.z.string().optional()
    })
});
//# sourceMappingURL=cryptoValidators.js.map