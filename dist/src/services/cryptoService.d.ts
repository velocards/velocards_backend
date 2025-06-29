import { XMoneyOrder, DepositHistoryItem } from '../repositories/cryptoRepository';
export interface CreateDepositOrderInput {
    amount: number;
    currency: string;
}
export interface CreateWithdrawalInput {
    amount: number;
    currency: string;
    address: string;
    network?: string;
}
export interface ExchangeRateResponse {
    from: string;
    to: string;
    rate: number;
    timestamp: string;
    expires_at: string;
}
export declare class CryptoService {
    private static readonly XMONEY_CONFIG;
    /**
     * Create a deposit order (xMoney order-based flow)
     */
    static createDepositOrder(userId: string, input: CreateDepositOrderInput): Promise<XMoneyOrder>;
    /**
     * Get deposit history for a user
     */
    static getDepositHistory(userId: string, filters?: {
        startDate?: string;
        endDate?: string;
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        deposits: DepositHistoryItem[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    /**
     * Get order status
     */
    static getOrderStatus(userId: string, orderId: string): Promise<XMoneyOrder>;
    /**
     * Process xMoney webhook
     */
    static processWebhook(payload: any, _signature: string): Promise<void>;
    private static handlePaymentDetected;
    private static handlePaymentReceived;
    private static handlePaymentCancelled;
}
//# sourceMappingURL=cryptoService.d.ts.map