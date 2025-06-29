export interface UserBalanceLedger {
    id: string;
    user_id: string;
    transaction_type: 'deposit' | 'card_funding' | 'refund' | 'withdrawal' | 'fee' | 'adjustment';
    amount: number;
    balance_before: number;
    balance_after: number;
    reference_type?: string;
    reference_id?: string;
    description?: string;
    created_at: Date;
}
export interface CreateUserBalanceLedgerData {
    user_id: string;
    transaction_type: 'deposit' | 'card_funding' | 'refund' | 'withdrawal' | 'fee' | 'adjustment';
    amount: number;
    balance_before: number;
    balance_after: number;
    reference_type?: string;
    reference_id?: string;
    description?: string;
}
export interface PaginationOptions {
    limit?: number;
    page?: number;
}
export interface LedgerSummary {
    totalCredits: number;
    totalDebits: number;
    netAmount: number;
    transactionCount: number;
    lastTransaction?: Date;
}
export declare class UserBalanceLedgerRepository {
    static supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", any>;
    static create(data: CreateUserBalanceLedgerData): Promise<UserBalanceLedger>;
    static findByUserId(userId: string, options?: PaginationOptions): Promise<{
        entries: UserBalanceLedger[];
        total: number;
    }>;
    static findByUserIdAndType(userId: string, transactionType: string, options?: PaginationOptions): Promise<{
        entries: UserBalanceLedger[];
        total: number;
    }>;
    static findByDateRange(userId: string, startDate: Date, endDate: Date, options?: PaginationOptions): Promise<{
        entries: UserBalanceLedger[];
        total: number;
    }>;
    static getUserBalanceSummary(userId: string): Promise<LedgerSummary>;
    static getLatestBalance(userId: string): Promise<number | null>;
    static findByReference(referenceType: string, referenceId: string): Promise<UserBalanceLedger[]>;
}
//# sourceMappingURL=userBalanceLedgerRepository.d.ts.map