import { Transaction, TransactionFilters as TxFilters, PaginationOptions as PageOptions } from '../repositories/transactionRepository';
export type TransactionFilters = TxFilters;
export type PaginationOptions = PageOptions;
export interface TransactionListResponse {
    transactions: Transaction[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface DisputeInput {
    reason: string;
}
export interface ExportOptions {
    format: 'csv' | 'json';
    filters?: TransactionFilters;
}
export declare class TransactionService {
    /**
     * Get user's transaction history with filters
     */
    static getTransactionHistory(userId: string, filters: TransactionFilters, pagination: PaginationOptions): Promise<TransactionListResponse>;
    /**
     * Get specific transaction details
     */
    static getTransactionDetails(userId: string, transactionId: string): Promise<Transaction>;
    /**
     * Get transactions for a specific card
     */
    static getCardTransactions(userId: string, cardId: string, pagination: PaginationOptions): Promise<TransactionListResponse>;
    /**
     * Dispute a transaction
     */
    static disputeTransaction(userId: string, transactionId: string, input: DisputeInput): Promise<Transaction>;
    /**
     * Export transactions in specified format
     */
    static exportTransactions(userId: string, options: ExportOptions): Promise<{
        data: string;
        filename: string;
        contentType: string;
    }>;
    /**
     * Get transaction statistics
     */
    static getTransactionStats(userId: string, period?: {
        from: Date;
        to: Date;
    }): Promise<{
        totalTransactions: number;
        totalAmount: number;
        byType: Record<string, number>;
        byCurrency: Record<string, number>;
    }>;
    /**
     * Create mock transactions for testing
     */
    static createMockTransaction(userId: string, cardId: string): Promise<Transaction>;
}
//# sourceMappingURL=transactionService.d.ts.map