import { z } from 'zod';
import { crypto as cryptoConfig } from '../../config/env';

// Supported fiat currencies from xMoney
const SUPPORTED_FIAT_CURRENCIES = [
  'AED', 'ARS', 'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'CZK', 'DKK',
  'DOP', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'JPY', 'KRW',
  'MYR', 'MXN', 'NOK', 'NZD', 'PHP', 'PKR', 'PLN', 'RON', 'RUB', 'SEK',
  'SGD', 'THB', 'TWD', 'USD', 'ZAR'
] as const;

// Common crypto currencies (mock list)
const SUPPORTED_CRYPTO_CURRENCIES = [
  'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'SOL'
] as const;

// Create deposit order schema
export const createDepositOrderSchema = z.object({
  body: z.object({
    amount: z.number()
      .positive('Amount must be positive')
      .min(cryptoConfig.minDepositAmount, `Minimum deposit amount is ${cryptoConfig.minDepositAmount}`)
      .max(cryptoConfig.maxDepositAmount, `Maximum deposit amount is ${cryptoConfig.maxDepositAmount}`),
    currency: z.enum(SUPPORTED_FIAT_CURRENCIES, {
      errorMap: () => ({ message: 'Unsupported currency' })
    })
  })
});

// Get deposit history schema
export const getDepositHistorySchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 10),
    status: z.enum(['pending', 'confirming', 'completed', 'failed']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }).refine(data => {
    if (data.page && data.page < 1) return false;
    if (data.limit && (data.limit < 1 || data.limit > 100)) return false;
    return true;
  }, {
    message: 'Invalid pagination parameters'
  })
});

// Create withdrawal schema
export const createWithdrawalSchema = z.object({
  body: z.object({
    amount: z.number()
      .positive('Amount must be positive')
      .min(0.001, 'Amount too small'),
    currency: z.enum(SUPPORTED_CRYPTO_CURRENCIES, {
      errorMap: () => ({ message: 'Unsupported cryptocurrency' })
    }),
    address: z.string()
      .min(10, 'Invalid address')
      .max(200, 'Address too long'),
    network: z.string().optional()
  })
});

// Get exchange rates schema
export const getExchangeRatesSchema = z.object({
  query: z.object({
    from: z.enum(SUPPORTED_CRYPTO_CURRENCIES).optional(),
    to: z.enum(SUPPORTED_FIAT_CURRENCIES).optional()
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
export const getOrderStatusSchema = z.object({
  params: z.object({
    orderId: z.string().uuid('Invalid order ID format')
  })
});

// Webhook payload schema (based on xMoney documentation)
export const webhookPayloadSchema = z.object({
  body: z.object({
    event_type: z.enum(['ORDER.PAYMENT.DETECTED', 'ORDER.PAYMENT.RECEIVED', 'ORDER.PAYMENT.CANCELLED']),
    resource: z.object({
      reference: z.string(),
      amount: z.string(),
      currency: z.string()
    }),
    signature: z.string(),
    state: z.string().optional()
  })
});

// Export type definitions
export type CreateDepositOrderInput = z.infer<typeof createDepositOrderSchema>['body'];
export type CreateWithdrawalInput = z.infer<typeof createWithdrawalSchema>['body'];
export type GetDepositHistoryQuery = z.infer<typeof getDepositHistorySchema>['query'];
export type GetExchangeRatesQuery = z.infer<typeof getExchangeRatesSchema>['query'];
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>['body'];