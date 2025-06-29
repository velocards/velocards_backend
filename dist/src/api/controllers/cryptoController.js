"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoController = void 0;
const cryptoService_1 = require("../../services/cryptoService");
const responseFormatter_1 = require("../../utils/responseFormatter");
const logger_1 = __importDefault(require("../../utils/logger"));
const errors_1 = require("../../utils/errors");
class CryptoController {
    /**
     * Create a deposit order
     * POST /api/v1/crypto/deposit/order
     */
    static async createDepositOrder(req, res, next) {
        try {
            const userId = req.user.sub;
            const { amount, currency } = req.body;
            logger_1.default.info('Creating deposit order', { userId, amount, currency });
            const order = await cryptoService_1.CryptoService.createDepositOrder(userId, { amount, currency });
            (0, responseFormatter_1.sendSuccess)(res, {
                order: {
                    id: order.id,
                    order_reference: order.order_reference,
                    amount: order.amount,
                    currency: order.currency,
                    status: order.status,
                    redirect_url: order.redirect_url,
                    created_at: order.created_at
                }
            }, 201);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get deposit history
     * GET /api/v1/crypto/deposit/history
     */
    static async getDepositHistory(req, res, next) {
        try {
            const userId = req.user.sub;
            const { page, limit, status, startDate, endDate } = req.query;
            logger_1.default.info('Fetching deposit history', { userId, filters: req.query });
            const result = await cryptoService_1.CryptoService.getDepositHistory(userId, {
                page,
                limit,
                status,
                startDate,
                endDate
            });
            (0, responseFormatter_1.sendSuccess)(res, result);
        }
        catch (error) {
            next(error);
        }
    }
    // /**
    //  * Create withdrawal - DISABLED (not supported)
    //  * POST /api/v1/crypto/withdraw
    //  */
    // static async createWithdrawal(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    //   try {
    //     const userId = req.user!.sub;
    //     const { amount, currency, address, network } = req.body;
    //     logger.info('Creating withdrawal', { userId, amount, currency, address });
    //     const transaction = await CryptoService.createWithdrawal(userId, {
    //       amount,
    //       currency,
    //       address,
    //       network
    //     });
    //     sendSuccess(res, {
    //       withdrawal: {
    //         id: transaction.id,
    //         amount: transaction.crypto_amount,
    //         currency: transaction.crypto_currency,
    //         address: transaction.wallet_address,
    //         status: transaction.status,
    //         fee: transaction.fee_amount,
    //         created_at: transaction.created_at
    //       }
    //     }, 201);
    //   } catch (error) {
    //     next(error);
    //   }
    // }
    // /**
    //  * Get exchange rates - DISABLED (not needed without withdrawals)
    //  * GET /api/v1/crypto/rates
    //  */
    // static async getExchangeRates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    //   try {
    //     const { from, to } = req.query as any;
    //     logger.info('Fetching exchange rates', { from, to });
    //     const rates = await CryptoService.getExchangeRates(from, to);
    //     sendSuccess(res, Array.isArray(rates) ? { rates } : { rate: rates });
    //   } catch (error) {
    //     next(error);
    //   }
    // }
    // /**
    //  * Get specific exchange rate - DISABLED (not needed without withdrawals)
    //  * GET /api/v1/crypto/rates/:from/:to
    //  */
    // static async getSpecificExchangeRate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    //   try {
    //     const { from, to } = req.params;
    //     if (!from || !to) {
    //       throw new AppError('VALIDATION_ERROR', 'Both from and to currencies are required', 400);
    //     }
    //     logger.info('Fetching specific exchange rate', { from, to });
    //     const rate = await CryptoService.getExchangeRates(from.toUpperCase(), to.toUpperCase());
    //     if (Array.isArray(rate)) {
    //       throw new AppError('VALIDATION_ERROR', 'Invalid currency pair', 400);
    //     }
    //     sendSuccess(res, { rate });
    //   } catch (error) {
    //     next(error);
    //   }
    // }
    /**
     * Get order status
     * GET /api/v1/crypto/orders/:orderId
     */
    static async getOrderStatus(req, res, next) {
        try {
            const userId = req.user.sub;
            const { orderId } = req.params;
            if (!orderId) {
                throw new errors_1.AppError('VALIDATION_ERROR', 'Order ID is required', 400);
            }
            logger_1.default.info('Fetching order status', { userId, orderId });
            const order = await cryptoService_1.CryptoService.getOrderStatus(userId, orderId);
            (0, responseFormatter_1.sendSuccess)(res, { order });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Process xMoney webhook
     * POST /api/v1/webhooks/xmoney
     * Note: This endpoint should not require authentication
     */
    static async processWebhook(req, res, _next) {
        try {
            const { signature } = req.body;
            const payload = req.body;
            logger_1.default.info('Processing xMoney webhook', {
                event_type: payload.event_type,
                reference: payload.resource?.reference
            });
            // Verify and process webhook
            await cryptoService_1.CryptoService.processWebhook(payload, signature);
            // xMoney expects a 200 OK response
            res.status(200).json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Webhook processing failed', { error, payload: req.body });
            // For webhooks, we typically want to return 200 even on error
            // to prevent retries if the error is on our side
            if (error.code === 'INVALID_SIGNATURE') {
                res.status(400).json({ success: false, error: 'Invalid signature' });
            }
            else {
                res.status(200).json({ success: true });
            }
        }
    }
}
exports.CryptoController = CryptoController;
//# sourceMappingURL=cryptoController.js.map