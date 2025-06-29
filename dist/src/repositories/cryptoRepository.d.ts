export interface XMoneyOrder {
    id: string;
    user_id: string;
    order_reference: string;
    amount: number;
    currency: string;
    crypto_currency?: string;
    status: 'pending' | 'paid' | 'expired' | 'cancelled';
    redirect_url?: string;
    callback_url?: string;
    return_url: string;
    cancel_url?: string;
    xmoney_order_id?: string;
    metadata?: any;
    created_at: string;
    updated_at?: string;
}
export interface CryptoTransaction {
    id: string;
    user_id: string;
    xmoney_order_id: string;
    xmoney_payment_id?: string;
    type: 'deposit' | 'withdrawal';
    crypto_currency: string;
    crypto_amount: number;
    fiat_currency: string;
    fiat_amount: number;
    exchange_rate?: number;
    wallet_address?: string;
    transaction_hash?: string;
    confirmations?: number;
    status: 'pending' | 'confirming' | 'completed' | 'failed';
    fee_amount?: number;
    metadata?: any;
    created_at: string;
    updated_at?: string;
}
export interface ExchangeRate {
    from_currency: string;
    to_currency: string;
    rate: number;
    timestamp: string;
}
export interface DepositHistoryItem {
    orderId: string;
    orderReference: string;
    amount: number;
    currency: string;
    status: string;
    requestedAt: string;
    lastUpdated?: string;
    expiresAt?: string;
    paymentUrl?: string;
    feeInfo?: {
        grossAmount: number;
        feeAmount: number;
        netAmount: number;
        feePercentage: number;
    } | null;
    transactionId?: string | null;
    cryptoCurrency?: string | null;
    cryptoAmount?: number | null;
    exchangeRate?: number | null;
    transactionFeeAmount?: number | null;
    creditedAmount?: number | null;
    completedAt?: string | null;
    transactionHash?: string | null;
    confirmations?: number | null;
    explorerUrls?: {
        transaction?: string;
        address?: string;
    } | null;
    metadata?: any;
}
export declare class CryptoRepository {
    static createOrder(orderData: Partial<XMoneyOrder>): Promise<XMoneyOrder>;
    static getOrderById(orderId: string): Promise<XMoneyOrder | null>;
    static getOrderByReference(reference: string): Promise<XMoneyOrder | null>;
    static updateOrder(orderId: string, updates: Partial<XMoneyOrder>): Promise<XMoneyOrder>;
    static getUserOrders(userId: string, filters?: {
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        orders: XMoneyOrder[];
        total: number;
    }>;
    static createTransaction(txData: Partial<CryptoTransaction>): Promise<CryptoTransaction>;
    static getTransactionById(transactionId: string): Promise<CryptoTransaction | null>;
    static getTransactionsByOrderId(orderId: string): Promise<CryptoTransaction[]>;
    static getUserPendingDepositsTotal(userId: string): Promise<number>;
    static updateTransaction(transactionId: string, updates: Partial<CryptoTransaction>): Promise<CryptoTransaction>;
    static getUserDepositHistory(userId: string, filters?: {
        startDate?: string;
        endDate?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        transactions: CryptoTransaction[];
        total: number;
    }>;
    static saveExchangeRate(rateData: ExchangeRate): Promise<void>;
    static getExchangeRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate | null>;
    static saveWithdrawalAddress(userId: string, address: string, currency: string, label?: string): Promise<void>;
    static getUserWithdrawalAddresses(userId: string): Promise<any[]>;
    /**
     * Get complete deposit history including pending orders and completed transactions
     * This replaces getUserDepositHistory to show all deposit statuses
     */
    static getCompleteDepositHistory(userId: string, filters?: {
        startDate?: string;
        endDate?: string;
        status?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        deposits: DepositHistoryItem[];
        total: number;
    }>;
    /**
     * Helper method to determine display status
     */
    private static getDisplayStatus;
}
//# sourceMappingURL=cryptoRepository.d.ts.map