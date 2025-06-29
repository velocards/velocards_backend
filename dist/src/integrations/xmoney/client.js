"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XMoneyClient = void 0;
exports.getXMoneyClient = getXMoneyClient;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../../utils/logger"));
class XMoneyClient {
    apiKey;
    baseUrl;
    webhookSecret;
    axiosInstance;
    isLive;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.webhookSecret = config.webhookSecret;
        this.isLive = config.isLive || false;
        // Get configuration from environment
        const { xmoney } = require('../../config/env');
        // Use sandbox or live URL based on isLive flag
        this.baseUrl = this.isLive ? xmoney.liveApiUrl : xmoney.sandboxApiUrl;
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: xmoney.apiTimeout,
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `Bearer ${this.apiKey}`
            }
        });
        // Add request/response interceptors for logging
        this.axiosInstance.interceptors.request.use((config) => {
            logger_1.default.debug('xMoney API Request', {
                method: config.method?.toUpperCase(),
                url: config.url,
                baseURL: config.baseURL
            });
            return config;
        }, (error) => {
            logger_1.default.error('xMoney API Request Error', { error });
            return Promise.reject(error);
        });
        this.axiosInstance.interceptors.response.use((response) => {
            logger_1.default.debug('xMoney API Response', {
                status: response.status,
                url: response.config.url
            });
            return response;
        }, (error) => {
            logger_1.default.error('xMoney API Response Error', {
                status: error.response?.status,
                url: error.config?.url,
                data: error.response?.data
            });
            return Promise.reject(error);
        });
        logger_1.default.info('xMoney client initialized', {
            baseUrl: this.baseUrl,
            isLive: this.isLive,
            mode: this.isLive ? 'LIVE' : 'SANDBOX'
        });
    }
    /**
     * Create an order for crypto payment
     */
    async createOrder(orderData) {
        try {
            const response = await this.axiosInstance.post('/stores/orders', orderData);
            logger_1.default.info('xMoney order created successfully', {
                orderId: response.data.data.id,
                reference: orderData.data.attributes.order.reference,
                amount: orderData.data.attributes.order.amount.total,
                currency: orderData.data.attributes.order.amount.currency
            });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to create xMoney order', {
                error: error.response?.data || error.message,
                orderData
            });
            throw new Error(`xMoney order creation failed: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
        }
    }
    /**
     * Get order details
     */
    async getOrder(orderId, includePayments = false) {
        try {
            const params = includePayments ? { include: 'payments' } : {};
            const response = await this.axiosInstance.get(`/stores/orders/${orderId}`, { params });
            logger_1.default.debug('xMoney order details retrieved', { orderId });
            return response.data;
        }
        catch (error) {
            logger_1.default.error('Failed to get xMoney order details', {
                error: error.response?.data || error.message,
                orderId
            });
            throw new Error(`Failed to get order details: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
        }
    }
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload) {
        try {
            // Remove signature from payload for verification
            const { signature, ...payloadWithoutSignature } = payload;
            // Sort payload recursively as per xMoney docs
            const sortedPayload = this.sortObjectRecursively(payloadWithoutSignature);
            // Join payload into string
            const joinedPayload = this.joinPayload(sortedPayload);
            // Generate HMAC signature
            const expectedSignature = crypto_1.default
                .createHmac('sha256', this.webhookSecret)
                .update(joinedPayload)
                .digest('hex');
            const isValid = expectedSignature === signature;
            logger_1.default.debug('xMoney webhook signature verification', {
                isValid,
                eventType: payload.event_type,
                reference: payload.resource?.reference
            });
            return isValid;
        }
        catch (error) {
            logger_1.default.error('Failed to verify xMoney webhook signature', { error });
            return false;
        }
    }
    /**
     * Process webhook payload
     */
    processWebhook(payload) {
        const isValid = this.verifyWebhookSignature(payload);
        return {
            isValid,
            eventType: payload.event_type,
            reference: payload.resource.reference,
            amount: payload.resource.amount,
            currency: payload.resource.currency,
            state: payload.state
        };
    }
    /**
     * Get supported currencies from swagger
     */
    getSupportedCurrencies() {
        return [
            'AED', 'ARS', 'AUD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'CZK', 'DKK',
            'DOP', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'JPY', 'KRW',
            'MYR', 'MXN', 'NOK', 'NZD', 'PHP', 'PKR', 'PLN', 'RON', 'RUB', 'SEK',
            'SGD', 'THB', 'TWD', 'USD', 'ZAR'
        ];
    }
    /**
     * Check if currency is supported
     */
    isCurrencySupported(currency) {
        return this.getSupportedCurrencies().includes(currency.toUpperCase());
    }
    // Private helper methods for webhook signature verification
    sortObjectRecursively(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sortObjectRecursively(item));
        }
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = this.sortObjectRecursively(obj[key]);
        });
        return sorted;
    }
    joinPayload(obj, prefix = '') {
        let result = '';
        if (typeof obj !== 'object' || obj === null) {
            return prefix + String(obj);
        }
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                result += this.joinPayload(item, `${prefix}${index}`);
            });
            return result;
        }
        Object.keys(obj).forEach(key => {
            result += prefix + key;
            result += this.joinPayload(obj[key], prefix);
        });
        return result;
    }
}
exports.XMoneyClient = XMoneyClient;
// Export singleton instance
let xmoneyClient = null;
function getXMoneyClient() {
    if (!xmoneyClient) {
        // Import env config here to avoid circular dependency
        const { xmoney } = require('../../config/env');
        xmoneyClient = new XMoneyClient({
            apiKey: xmoney.apiKey,
            webhookSecret: xmoney.webhookSecret,
            isLive: xmoney.useLive
        });
    }
    return xmoneyClient;
}
//# sourceMappingURL=client.js.map