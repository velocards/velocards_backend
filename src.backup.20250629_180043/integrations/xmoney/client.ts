import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import logger from '../../utils/logger';

// xMoney API Types (based on swagger.yaml)
export interface XMoneyOrderInput {
  reference: string;
  amount: {
    total: string;
    currency: string;
    details?: {
      subtotal?: string;
      shipping?: string;
      tax?: string;
      discount?: string;
    };
  };
  return_urls: {
    return_url: string;
    cancel_url?: string;
    callback_url?: string;
  };
  line_items?: Array<{
    sku?: string;
    name: string;
    price: string;
    currency: string;
    quantity: number;
  }>;
}

export interface XMoneyCustomer {
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  billing_address?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country: string; // ISO 3166-1 Alpha-2
}

export interface XMoneyCreateOrderRequest {
  data: {
    type: 'orders';
    attributes: {
      order: XMoneyOrderInput;
      customer: XMoneyCustomer;
    };
  };
}

export interface XMoneyOrderResponse {
  data: {
    type: 'orders_redirect';
    id: string; // UUID
    attributes: {
      redirect_url: string;
    };
  };
}

export interface XMoneyOrder {
  id: string;
  type: 'orders';
  attributes: {
    status: 'pending' | 'paid';
    created_at: string;
    total_amount: {
      value: string;
      currency: string;
    };
    customer: XMoneyCustomer;
    merchant_uuid: string;
    items?: Array<{
      sku?: string;
      name: string;
      price: string;
      currency: string;
      quantity: number;
    }>;
  };
}

export interface XMoneyOrderDetailsResponse {
  data: XMoneyOrder;
}

export interface XMoneyWebhookPayload {
  event_type: 'ORDER.PAYMENT.DETECTED' | 'ORDER.PAYMENT.RECEIVED' | 'ORDER.PAYMENT.CANCELLED';
  resource: {
    reference: string;
    amount: string;
    currency: string;
  };
  signature: string;
  state: 'pending' | 'completed' | 'cancelled';
}

export interface XMoneyErrorResponse {
  errors: Array<{
    detail: string;
  }>;
}

export class XMoneyClient {
  private apiKey: string;
  private baseUrl: string;
  private webhookSecret: string;
  private axiosInstance: AxiosInstance;
  private isLive: boolean;

  constructor(config: {
    apiKey: string;
    webhookSecret: string;
    isLive?: boolean;
  }) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.isLive = config.isLive || false;

    // Get configuration from environment
    const { xmoney } = require('../../config/env');
    
    // Use sandbox or live URL based on isLive flag
    this.baseUrl = this.isLive ? xmoney.liveApiUrl : xmoney.sandboxApiUrl;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: xmoney.apiTimeout,
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    // Add request/response interceptors for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('xMoney API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        logger.error('xMoney API Request Error', { error });
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('xMoney API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('xMoney API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );

    logger.info('xMoney client initialized', {
      baseUrl: this.baseUrl,
      isLive: this.isLive,
      mode: this.isLive ? 'LIVE' : 'SANDBOX'
    });
  }

  /**
   * Create an order for crypto payment
   */
  async createOrder(orderData: XMoneyCreateOrderRequest): Promise<XMoneyOrderResponse> {
    try {
      const response = await this.axiosInstance.post<XMoneyOrderResponse>(
        '/stores/orders',
        orderData
      );

      logger.info('xMoney order created successfully', {
        orderId: response.data.data.id,
        reference: orderData.data.attributes.order.reference,
        amount: orderData.data.attributes.order.amount.total,
        currency: orderData.data.attributes.order.amount.currency
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to create xMoney order', {
        error: error.response?.data || error.message,
        orderData
      });
      throw new Error(`xMoney order creation failed: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string, includePayments: boolean = false): Promise<XMoneyOrderDetailsResponse> {
    try {
      const params = includePayments ? { include: 'payments' } : {};
      const response = await this.axiosInstance.get<XMoneyOrderDetailsResponse>(
        `/stores/orders/${orderId}`,
        { params }
      );

      logger.debug('xMoney order details retrieved', { orderId });
      return response.data;
    } catch (error: any) {
      logger.error('Failed to get xMoney order details', {
        error: error.response?.data || error.message,
        orderId
      });
      throw new Error(`Failed to get order details: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: XMoneyWebhookPayload): boolean {
    try {
      // Remove signature from payload for verification
      const { signature, ...payloadWithoutSignature } = payload;

      // Sort payload recursively as per xMoney docs
      const sortedPayload = this.sortObjectRecursively(payloadWithoutSignature);

      // Join payload into string
      const joinedPayload = this.joinPayload(sortedPayload);

      // Generate HMAC signature
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(joinedPayload)
        .digest('hex');

      const isValid = expectedSignature === signature;

      logger.debug('xMoney webhook signature verification', {
        isValid,
        eventType: payload.event_type,
        reference: payload.resource?.reference
      });

      return isValid;
    } catch (error) {
      logger.error('Failed to verify xMoney webhook signature', { error });
      return false;
    }
  }

  /**
   * Process webhook payload
   */
  processWebhook(payload: XMoneyWebhookPayload): {
    isValid: boolean;
    eventType: string;
    reference: string;
    amount: string;
    currency: string;
    state: string;
  } {
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
  getSupportedCurrencies(): string[] {
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
  isCurrencySupported(currency: string): boolean {
    return this.getSupportedCurrencies().includes(currency.toUpperCase());
  }

  // Private helper methods for webhook signature verification

  private sortObjectRecursively(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectRecursively(item));
    }

    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObjectRecursively(obj[key]);
    });
    return sorted;
  }

  private joinPayload(obj: any, prefix: string = ''): string {
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

// Export singleton instance
let xmoneyClient: XMoneyClient | null = null;

export function getXMoneyClient(): XMoneyClient {
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