"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const cryptoRepository_1 = require("../repositories/cryptoRepository");
const userRepository_1 = require("../repositories/userRepository");
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
const client_1 = require("../integrations/xmoney/client");
const env_1 = require("../config/env");
const pricingService_1 = __importDefault(require("./pricingService"));
const database_1 = require("../config/database");
const blockchainExplorers_1 = require("../utils/blockchainExplorers");
class CryptoService {
    // Use centralized environment configuration
    static XMONEY_CONFIG = {
        returnUrl: env_1.xmoney.returnUrl,
        cancelUrl: env_1.xmoney.cancelUrl,
        callbackUrl: env_1.xmoney.callbackUrl
    };
    // Supported cryptocurrencies (common ones - xMoney supports many)
    // private static readonly SUPPORTED_CRYPTOS = [
    //   'BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE', 'MATIC', 'SOL'
    // ];
    /**
     * Create a deposit order (xMoney order-based flow)
     */
    static async createDepositOrder(userId, input) {
        try {
            // Validate input
            if (input.amount <= 0) {
                throw new errors_1.ValidationError('Amount must be positive');
            }
            // Get xMoney client and check currency support
            const xmoneyClient = (0, client_1.getXMoneyClient)();
            if (!xmoneyClient.isCurrencySupported(input.currency)) {
                throw new errors_1.ValidationError(`Currency ${input.currency} not supported by xMoney`);
            }
            // Get user to ensure they exist
            const user = await userRepository_1.UserRepository.findById(userId);
            if (!user) {
                throw new errors_1.AppError('USER_NOT_FOUND', 'User not found', 404);
            }
            // Calculate deposit fee based on user's tier
            const feeInfo = await pricingService_1.default.applyDepositFee(userId, input.amount);
            // Generate order reference
            const orderReference = `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            // Create order in database first with fee information
            const order = await cryptoRepository_1.CryptoRepository.createOrder({
                user_id: userId,
                order_reference: orderReference,
                amount: input.amount,
                currency: input.currency,
                status: 'pending',
                return_url: this.XMONEY_CONFIG.returnUrl,
                cancel_url: this.XMONEY_CONFIG.cancelUrl,
                callback_url: this.XMONEY_CONFIG.callbackUrl,
                metadata: {
                    gross_amount: feeInfo.grossAmount,
                    fee_amount: feeInfo.feeAmount,
                    net_amount: feeInfo.netAmount,
                    fee_percentage: feeInfo.feePercentage
                }
            });
            // Create xMoney order request
            const xmoneyOrderData = {
                data: {
                    type: 'orders',
                    attributes: {
                        order: {
                            reference: orderReference,
                            amount: {
                                total: input.amount.toFixed(2),
                                currency: input.currency.toUpperCase()
                            },
                            return_urls: {
                                return_url: this.XMONEY_CONFIG.returnUrl,
                                cancel_url: this.XMONEY_CONFIG.cancelUrl,
                                callback_url: this.XMONEY_CONFIG.callbackUrl
                            }
                        },
                        customer: {
                            email: user.email,
                            country: env_1.crypto.defaultCountryCode
                        }
                    }
                }
            };
            // Call real xMoney API
            const xmoneyResponse = await xmoneyClient.createOrder(xmoneyOrderData);
            // Update order with real xMoney details
            const updatedOrder = await cryptoRepository_1.CryptoRepository.updateOrder(order.id, {
                redirect_url: xmoneyResponse.data.attributes.redirect_url,
                metadata: {
                    ...order.metadata,
                    xmoney_order_id: xmoneyResponse.data.id,
                    xmoney_response: xmoneyResponse
                }
            });
            logger_1.default.info('Real xMoney deposit order created', {
                orderId: order.id,
                xmoneyOrderId: xmoneyResponse.data.id,
                userId,
                amount: input.amount,
                currency: input.currency,
                redirectUrl: xmoneyResponse.data.attributes.redirect_url
            });
            return updatedOrder;
        }
        catch (error) {
            logger_1.default.error('Failed to create deposit order', { error, userId, input });
            throw error;
        }
    }
    /**
     * Get deposit history for a user
     */
    static async getDepositHistory(userId, filters) {
        try {
            const page = filters?.page || 1;
            const limit = filters?.limit || 10;
            const offset = (page - 1) * limit;
            // Use new method that includes pending orders
            const { deposits, total } = await cryptoRepository_1.CryptoRepository.getCompleteDepositHistory(userId, {
                ...filters,
                limit,
                offset
            });
            return {
                deposits,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get deposit history', { error, userId });
            throw error;
        }
    }
    // /**
    //  * Create a withdrawal request - DISABLED (not supported)
    //  */
    // static async createWithdrawal(
    //   userId: string,
    //   input: CreateWithdrawalInput
    // ): Promise<CryptoTransaction> {
    //   try {
    //     // Validate input
    //     if (input.amount <= 0) {
    //       throw new ValidationError('Amount must be positive');
    //     }
    //     if (!this.SUPPORTED_CRYPTOS.includes(input.currency)) {
    //       throw new ValidationError(`Cryptocurrency ${input.currency} not supported`);
    //     }
    //     // Validate address format (basic check)
    //     if (!input.address || input.address.length < 10) {
    //       throw new ValidationError('Invalid withdrawal address');
    //     }
    //     // Get user and check balance
    //     const user = await UserRepository.findById(userId);
    //     if (!user) {
    //       throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    //     }
    //     // Convert crypto amount to fiat value (mock conversion)
    //     const exchangeRateResponse = await this.getExchangeRates(input.currency, 'USD');
    //     if (Array.isArray(exchangeRateResponse)) {
    //       throw new ValidationError('Failed to get specific exchange rate');
    //     }
    //     const fiatAmount = input.amount * exchangeRateResponse.rate;
    //     // Check if user has sufficient balance
    //     if (user.virtual_balance < fiatAmount) {
    //       throw new InsufficientBalanceError(fiatAmount, user.virtual_balance);
    //     }
    //     // Create withdrawal order
    //     const order = await CryptoRepository.createOrder({
    //       user_id: userId,
    //       order_reference: `WD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    //       amount: fiatAmount,
    //       currency: 'USD',
    //       crypto_currency: input.currency,
    //       status: 'pending',
    //       return_url: this.XMONEY_CONFIG.returnUrl,
    //       metadata: {
    //         withdrawal_address: input.address,
    //         network: input.network || 'default'
    //       }
    //     });
    //     // Create withdrawal transaction
    //     const transaction = await CryptoRepository.createTransaction({
    //       user_id: userId,
    //       xmoney_order_id: order.id,
    //       type: 'withdrawal',
    //       crypto_currency: input.currency,
    //       crypto_amount: input.amount,
    //       fiat_currency: 'USD',
    //       fiat_amount: fiatAmount,
    //       exchange_rate: exchangeRateResponse.rate,
    //       wallet_address: input.address,
    //       status: 'pending',
    //       fee_amount: fiatAmount * cryptoConfig.withdrawalFeePercentage
    //     });
    //     // Deduct balance from user
    //     await UserRepository.updateBalance(userId, fiatAmount, 'subtract');
    //     // Balance change is recorded automatically by updateBalance method
    //     logger.info('Crypto withdrawal created', {
    //       transactionId: transaction.id,
    //       userId,
    //       amount: input.amount,
    //       currency: input.currency,
    //       address: input.address
    //     });
    //     return transaction;
    //   } catch (error: any) {
    //     logger.error('Failed to create withdrawal', { error, userId, input });
    //     throw error;
    //   }
    // }
    // /**
    //  * Get current exchange rates - DISABLED (not needed without withdrawals)
    //  */
    // static async getExchangeRates(
    //   from?: string,
    //   to?: string
    // ): Promise<ExchangeRateResponse | ExchangeRateResponse[]> {
    //   try {
    //     // If specific pair requested
    //     if (from && to) {
    //       // Check cache first
    //       const cached = await CryptoRepository.getExchangeRate(from, to);
    //       if (cached) {
    //         return {
    //           from: cached.from_currency,
    //           to: cached.to_currency,
    //           rate: cached.rate,
    //           timestamp: cached.timestamp,
    //           expires_at: new Date(Date.now() + cryptoConfig.exchangeRateCacheTtlMs).toISOString()
    //         };
    //       }
    //
    //       // Mock exchange rate (in production, call real API)
    //       const mockRate = this.generateMockExchangeRate(from, to);
    //       
    //       // Cache the rate
    //       await CryptoRepository.saveExchangeRate({
    //         from_currency: from,
    //         to_currency: to,
    //         rate: mockRate,
    //         timestamp: new Date().toISOString()
    //       });
    //
    //       return {
    //         from,
    //         to,
    //         rate: mockRate,
    //         timestamp: new Date().toISOString(),
    //         expires_at: new Date(Date.now() + cryptoConfig.exchangeRateCacheTtlMs).toISOString()
    //       };
    //     }
    //
    //     // Return all available rates (mock)
    //     const rates: ExchangeRateResponse[] = [];
    //     for (const crypto of this.SUPPORTED_CRYPTOS) {
    //       for (const fiat of ['USD', 'EUR', 'GBP']) {
    //         rates.push({
    //           from: crypto,
    //           to: fiat,
    //           rate: this.generateMockExchangeRate(crypto, fiat),
    //           timestamp: new Date().toISOString(),
    //           expires_at: new Date(Date.now() + cryptoConfig.exchangeRateCacheTtlMs).toISOString()
    //         });
    //       }
    //     }
    //
    //     return rates;
    //   } catch (error: any) {
    //     logger.error('Failed to get exchange rates', { error, from, to });
    //     throw error;
    //   }
    // }
    /**
     * Get order status
     */
    static async getOrderStatus(userId, orderId) {
        try {
            const order = await cryptoRepository_1.CryptoRepository.getOrderById(orderId);
            if (!order) {
                throw new errors_1.AppError('ORDER_NOT_FOUND', 'Order not found', 404);
            }
            // Verify order belongs to user
            if (order.user_id !== userId) {
                throw new errors_1.AppError('FORBIDDEN', 'Access denied', 403);
            }
            // If we have an xMoney order ID, fetch latest status from xMoney
            if (order.metadata?.xmoney_order_id) {
                try {
                    const xmoneyClient = (0, client_1.getXMoneyClient)();
                    const xmoneyOrder = await xmoneyClient.getOrder(order.metadata.xmoney_order_id, true);
                    // Update our order status if it changed
                    if (xmoneyOrder.data.attributes.status !== order.status) {
                        await cryptoRepository_1.CryptoRepository.updateOrder(orderId, {
                            status: xmoneyOrder.data.attributes.status,
                            metadata: {
                                ...order.metadata,
                                xmoney_latest_response: xmoneyOrder,
                                last_status_check: new Date().toISOString()
                            }
                        });
                        // Update local order object
                        order.status = xmoneyOrder.data.attributes.status;
                    }
                    logger_1.default.debug('xMoney order status updated', {
                        orderId,
                        xmoneyOrderId: order.metadata.xmoney_order_id,
                        status: xmoneyOrder.data.attributes.status
                    });
                }
                catch (xmoneyError) {
                    logger_1.default.warn('Failed to fetch xMoney order status', {
                        orderId,
                        xmoneyOrderId: order.metadata?.xmoney_order_id,
                        error: xmoneyError
                    });
                    // Continue with local order data
                }
            }
            // Get associated transactions
            const transactions = await cryptoRepository_1.CryptoRepository.getTransactionsByOrderId(orderId);
            // Add explorer URLs to transactions that have them
            const transactionsWithExplorer = transactions.map(tx => {
                if (tx.transaction_hash && tx.crypto_currency) {
                    const explorerUrls = (0, blockchainExplorers_1.getBlockchainExplorerUrls)(tx.crypto_currency, tx.transaction_hash);
                    return {
                        ...tx,
                        explorer_urls: explorerUrls
                    };
                }
                return tx;
            });
            return {
                ...order,
                metadata: {
                    ...order.metadata,
                    transactions: transactionsWithExplorer
                }
            };
        }
        catch (error) {
            logger_1.default.error('Failed to get order status', { error, userId, orderId });
            throw error;
        }
    }
    /**
     * Process xMoney webhook
     */
    static async processWebhook(payload, _signature) {
        try {
            // Use real xMoney client for signature verification
            const xmoneyClient = (0, client_1.getXMoneyClient)();
            const webhookData = xmoneyClient.processWebhook(payload);
            if (!webhookData.isValid) {
                throw new errors_1.AppError('INVALID_SIGNATURE', 'Invalid webhook signature', 400);
            }
            logger_1.default.info('Processing real xMoney webhook', {
                eventType: webhookData.eventType,
                reference: webhookData.reference,
                state: webhookData.state,
                amount: webhookData.amount,
                currency: webhookData.currency
            });
            switch (webhookData.eventType) {
                case 'ORDER.PAYMENT.DETECTED':
                    await this.handlePaymentDetected(webhookData);
                    break;
                case 'ORDER.PAYMENT.RECEIVED':
                    await this.handlePaymentReceived(webhookData);
                    break;
                case 'ORDER.PAYMENT.CANCELLED':
                    await this.handlePaymentCancelled(webhookData);
                    break;
                default:
                    logger_1.default.warn('Unknown webhook event type', { eventType: webhookData.eventType });
            }
        }
        catch (error) {
            logger_1.default.error('Failed to process webhook', { error, payload });
            throw error;
        }
    }
    // Private helper methods
    // private static generateMockExchangeRate(from: string, to: string): number {
    //   // Mock exchange rates (in production, use real API)
    //   const mockRates: Record<string, Record<string, number>> = {
    //     BTC: { USD: 65432.50, EUR: 60123.20, GBP: 51234.80 },
    //     ETH: { USD: 3456.78, EUR: 3175.42, GBP: 2703.56 },
    //     USDT: { USD: 1.00, EUR: 0.92, GBP: 0.78 },
    //     USDC: { USD: 1.00, EUR: 0.92, GBP: 0.78 },
    //     BNB: { USD: 456.78, EUR: 419.63, GBP: 357.30 },
    //     XRP: { USD: 0.52, EUR: 0.48, GBP: 0.41 },
    //     ADA: { USD: 0.38, EUR: 0.35, GBP: 0.30 },
    //     DOGE: { USD: 0.08, EUR: 0.07, GBP: 0.06 },
    //     MATIC: { USD: 0.72, EUR: 0.66, GBP: 0.56 },
    //     SOL: { USD: 98.76, EUR: 90.66, GBP: 77.23 }
    //   };
    //
    //   // Add some randomness to simulate market fluctuation
    //   const baseRate = mockRates[from]?.[to] || 1;
    //   const fluctuation = (Math.random() - 0.5) * 0.02; // ±1% fluctuation
    //   return baseRate * (1 + fluctuation);
    // }
    static async handlePaymentDetected(webhookData) {
        const order = await cryptoRepository_1.CryptoRepository.getOrderByReference(webhookData.reference);
        if (!order) {
            logger_1.default.warn('Order not found for payment detected webhook', { reference: webhookData.reference });
            return;
        }
        // Update order status
        await cryptoRepository_1.CryptoRepository.updateOrder(order.id, {
            status: 'pending',
            metadata: {
                ...order.metadata,
                payment_detected_at: new Date().toISOString(),
                webhook_data: webhookData
            }
        });
        logger_1.default.info('Payment detected via xMoney webhook', {
            orderId: order.id,
            reference: webhookData.reference,
            amount: webhookData.amount,
            currency: webhookData.currency
        });
    }
    static async handlePaymentReceived(webhookData) {
        const order = await cryptoRepository_1.CryptoRepository.getOrderByReference(webhookData.reference);
        if (!order) {
            logger_1.default.warn('Order not found for payment received webhook', { reference: webhookData.reference });
            return;
        }
        // Extract transaction hash from webhook data if available
        const transactionHash = webhookData.transaction_hash || webhookData.tx_hash || webhookData.metadata?.transaction_hash;
        // Get blockchain explorer URLs if we have a transaction hash
        let explorerUrls = null;
        if (transactionHash && webhookData.currency) {
            explorerUrls = (0, blockchainExplorers_1.getBlockchainExplorerUrls)(webhookData.currency, transactionHash, undefined, webhookData.network);
        }
        // Update order status to paid
        await cryptoRepository_1.CryptoRepository.updateOrder(order.id, {
            status: 'paid',
            metadata: {
                ...order.metadata,
                payment_received_at: new Date().toISOString(),
                webhook_data: webhookData,
                transaction_hash: transactionHash,
                explorer_urls: explorerUrls
            }
        });
        // Get fee information from order metadata
        const feeInfo = order.metadata?.fee_amount ? {
            grossAmount: order.metadata.gross_amount || order.amount,
            feeAmount: order.metadata.fee_amount || 0,
            netAmount: order.metadata.net_amount || order.amount,
            feePercentage: order.metadata.fee_percentage || 0
        } : await pricingService_1.default.applyDepositFee(order.user_id, order.amount);
        // Create crypto transaction record with transaction hash and explorer URLs
        const transaction = await cryptoRepository_1.CryptoRepository.createTransaction({
            user_id: order.user_id,
            xmoney_order_id: order.id,
            type: 'deposit',
            crypto_currency: webhookData.currency,
            crypto_amount: parseFloat(webhookData.amount),
            fiat_currency: order.currency,
            fiat_amount: order.amount,
            exchange_rate: order.amount / parseFloat(webhookData.amount),
            status: 'completed',
            fee_amount: feeInfo.feeAmount,
            transaction_hash: transactionHash,
            metadata: {
                gross_amount: feeInfo.grossAmount,
                net_amount: feeInfo.netAmount,
                fee_percentage: feeInfo.feePercentage,
                explorer_urls: explorerUrls
            }
        });
        // Update user balance with NET amount (after fee deduction)
        await userRepository_1.UserRepository.adjustBalance(order.user_id, feeInfo.netAmount, 'add');
        // Record fee in balance ledger if applicable
        if (feeInfo.feeAmount > 0) {
            await database_1.supabase
                .from('user_balance_ledger')
                .insert({
                user_id: order.user_id,
                transaction_type: 'deposit_fee',
                amount: feeInfo.feeAmount,
                balance_before: 0, // Fee is deducted before crediting
                balance_after: 0,
                reference_type: 'crypto_deposit',
                reference_id: transaction.id,
                description: `Deposit fee (${feeInfo.feePercentage}%) on ${order.currency} ${order.amount}`,
                metadata: {
                    transaction_id: transaction.id,
                    order_id: order.id,
                    fee_percentage: feeInfo.feePercentage
                }
            });
        }
        logger_1.default.info('Real crypto payment received and processed', {
            orderId: order.id,
            transactionId: transaction.id,
            grossAmount: feeInfo.grossAmount,
            feeAmount: feeInfo.feeAmount,
            netCredited: feeInfo.netAmount,
            cryptoAmount: webhookData.amount,
            cryptoCurrency: webhookData.currency
        });
    }
    static async handlePaymentCancelled(webhookData) {
        const order = await cryptoRepository_1.CryptoRepository.getOrderByReference(webhookData.reference);
        if (!order) {
            logger_1.default.warn('Order not found for payment cancelled webhook', { reference: webhookData.reference });
            return;
        }
        // Update order status
        await cryptoRepository_1.CryptoRepository.updateOrder(order.id, {
            status: 'cancelled',
            metadata: {
                ...order.metadata,
                cancelled_at: new Date().toISOString(),
                webhook_data: webhookData
            }
        });
        logger_1.default.info('Crypto payment cancelled via xMoney webhook', {
            orderId: order.id,
            reference: webhookData.reference
        });
    }
}
exports.CryptoService = CryptoService;
//# sourceMappingURL=cryptoService.js.map