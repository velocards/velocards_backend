export interface CryptoTransaction {
    id: string;
    user_id: string;
    xmoney_payment_id: string;
    type: 'deposit' | 'withdrawal';
    crypto_currency: string;
    crypto_amount: number;
    fiat_currency: string;
    fiat_amount: number;
    exchange_rate?: number;
    wallet_address?: string;
    transaction_hash?: string;
    confirmations?: number;
    status: 'pending' | 'confirming' | 'completed' | 'failed' | 'expired';
    fee_amount?: number;
    synced_at?: Date;
    metadata?: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
export interface CreateCryptoTransactionData {
    user_id: string;
    xmoney_payment_id: string;
    type: 'deposit' | 'withdrawal';
    crypto_currency: string;
    crypto_amount: number;
    fiat_currency: string;
    fiat_amount: number;
    exchange_rate?: number;
    wallet_address?: string;
    status?: 'pending' | 'confirming' | 'completed' | 'failed';
    metadata?: Record<string, any>;
}
export interface UpdateCryptoTransactionData {
    status?: 'pending' | 'confirming' | 'completed' | 'failed' | 'expired';
    crypto_amount?: number;
    fiat_amount?: number;
    exchange_rate?: number;
    transaction_hash?: string;
    confirmations?: number;
    fee_amount?: number;
    synced_at?: Date;
    metadata?: Record<string, any>;
}
export declare class CryptoTransactionRepository {
    static supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", any>;
    static create(data: CreateCryptoTransactionData): Promise<CryptoTransaction>;
    static findById(id: string): Promise<CryptoTransaction | null>;
    static findByXMoneyId(xmoneyPaymentId: string): Promise<CryptoTransaction | null>;
    static findByUserId(userId: string): Promise<CryptoTransaction[]>;
    static findPendingByUser(userId: string): Promise<CryptoTransaction[]>;
    static findPendingAfter(cutoffTime: Date): Promise<CryptoTransaction[]>;
    static findStuckOrders(cutoffTime: Date): Promise<CryptoTransaction[]>;
    static findExpiredOrders(cutoffTime: Date): Promise<CryptoTransaction[]>;
    static findInconsistentStates(): Promise<CryptoTransaction[]>;
    static updateFromXMoney(id: string, data: UpdateCryptoTransactionData): Promise<CryptoTransaction>;
    static markAsProcessed(id: string): Promise<void>;
    static markAsExpired(id: string): Promise<void>;
}
//# sourceMappingURL=cryptoTransactionRepository.d.ts.map