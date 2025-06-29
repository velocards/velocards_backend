export interface Transaction {
    id: string;
    user_id: string;
    card_id?: string;
    admediacards_transaction_id?: string;
    type: 'authorization' | 'capture' | 'refund' | 'reversal' | 'deposit' | 'withdrawal' | 'fee';
    amount: number;
    currency: string;
    merchant_name?: string;
    merchant_category?: string;
    merchant_country?: string;
    status: 'pending' | 'completed' | 'failed' | 'reversed' | 'disputed';
    response_code?: string;
    response_message?: string;
    dispute_reason?: string;
    dispute_status?: 'pending' | 'resolved' | 'rejected';
    parent_transaction_id?: string;
    synced_at?: Date;
    metadata?: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
export interface TransactionFilters {
    card_id?: string;
    type?: string;
    status?: string;
    from_date?: Date;
    to_date?: Date;
    min_amount?: number;
    max_amount?: number;
    merchant_name?: string;
}
export interface PaginationOptions {
    page: number;
    limit: number;
    orderBy?: 'created_at' | 'amount';
    orderDirection?: 'asc' | 'desc';
}
export declare class TransactionRepository {
    /**
     * Get transaction by ID
     */
    static findById(transactionId: string): Promise<Transaction | null>;
    /**
     * Get transactions for a user with filters and pagination
     */
    static findByUser(userId: string, filters: TransactionFilters | undefined, pagination: PaginationOptions): Promise<{
        transactions: Transaction[];
        total: number;
    }>;
    /**
     * Get transactions for a specific card
     */
    static findByCard(cardId: string, pagination: PaginationOptions): Promise<{
        transactions: Transaction[];
        total: number;
    }>;
    /**
     * Create a new transaction (for mock purposes)
     */
    static create(data: Partial<Transaction>): Promise<Transaction>;
    /**
     * Update transaction status
     */
    static updateStatus(transactionId: string, status: Transaction['status'], additionalData?: Partial<Transaction>): Promise<Transaction>;
    /**
     * Create a dispute for a transaction
     */
    static createDispute(transactionId: string, reason: string): Promise<Transaction>;
    /**
     * Get transaction statistics for a user
     */
    static getUserStats(userId: string, period?: {
        from: Date;
        to: Date;
    }): Promise<{
        totalTransactions: number;
        totalAmount: number;
        byType: Record<string, number>;
        byCurrency: Record<string, number>;
    }>;
    /**
     * Sync transaction from Admediacards
     */
    static syncFromAdmediacards(cardId: string, admediacardsTransaction: any): Promise<Transaction>;
    /**
     * Map Admediacards transaction type to our type
     */
    private static mapAdmediacardsType;
    /**
     * Map Admediacards status to our status
     */
    private static mapAdmediacardsStatus;
}
//# sourceMappingURL=transactionRepository.d.ts.map