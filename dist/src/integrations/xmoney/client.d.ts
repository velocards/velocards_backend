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
    country: string;
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
        id: string;
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
export declare class XMoneyClient {
    private apiKey;
    private baseUrl;
    private webhookSecret;
    private axiosInstance;
    private isLive;
    constructor(config: {
        apiKey: string;
        webhookSecret: string;
        isLive?: boolean;
    });
    /**
     * Create an order for crypto payment
     */
    createOrder(orderData: XMoneyCreateOrderRequest): Promise<XMoneyOrderResponse>;
    /**
     * Get order details
     */
    getOrder(orderId: string, includePayments?: boolean): Promise<XMoneyOrderDetailsResponse>;
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload: XMoneyWebhookPayload): boolean;
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
    };
    /**
     * Get supported currencies from swagger
     */
    getSupportedCurrencies(): string[];
    /**
     * Check if currency is supported
     */
    isCurrencySupported(currency: string): boolean;
    private sortObjectRecursively;
    private joinPayload;
}
export declare function getXMoneyClient(): XMoneyClient;
//# sourceMappingURL=client.d.ts.map