export interface User {
    id: string;
    email: string;
    phone?: string | null;
    email_verified: boolean;
    kyc_status: 'pending' | 'approved' | 'rejected' | 'expired';
    kyc_completed_at?: Date | null;
    risk_score: number;
    account_status: 'active' | 'suspended' | 'closed';
    virtual_balance: number;
    total_spent: number;
    role?: string;
    tier_id?: string | null;
    tier_assigned_at?: Date | null;
    tier?: {
        id: string;
        tier_level: number;
        name: string;
        display_name: string;
        description?: string;
        features?: any;
    };
    metadata: {
        first_name?: string;
        last_name?: string;
        password_hash?: string;
        [key: string]: any;
    };
    created_at: Date;
    updated_at: Date;
}
export interface CreateUserData {
    email: string;
    password_hash: string;
    phone?: string | null;
    role?: string;
    metadata: {
        first_name: string;
        last_name: string;
    };
}
export interface UpdateUserData {
    phone?: string | null;
    email_verified?: boolean;
    kyc_status?: User['kyc_status'];
    account_status?: User['account_status'];
    metadata?: Partial<User['metadata']>;
}
export declare class UserRepository {
    static supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", any>;
    static create(data: CreateUserData): Promise<User>;
    static findById(id: string): Promise<User | null>;
    static findByEmail(email: string): Promise<User | null>;
    static updateBalance(id: string, newBalance: number): Promise<User>;
    static update(id: string, data: UpdateUserData): Promise<User>;
    static adjustBalance(id: string, amount: number, operation: 'add' | 'subtract'): Promise<User>;
    private static recordBalanceChange;
    static verifyEmail(id: string): Promise<void>;
    static isEmailAvailable(email: string): Promise<boolean>;
    static getPasswordHash(userId: string): Promise<string | null>;
    static updatePasswordHash(userId: string, newPasswordHash: string): Promise<void>;
    static recordAuthEvent(userId: string | null, eventType: string, ipAddress?: string, userAgent?: string, metadata?: any): Promise<void>;
}
//# sourceMappingURL=userRepository.d.ts.map