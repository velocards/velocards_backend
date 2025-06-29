export interface Card {
    id: string;
    user_id: string;
    program_id: number;
    bin: string;
    name: string;
    address?: string;
    phone_number?: string;
    exp_month: string;
    exp_year: string;
    cvv?: string;
    admediacards_card_id: string;
    card_token: string;
    masked_pan: string;
    card_type: 'single_use' | 'multi_use';
    is_active?: boolean;
    balance_cents?: number;
    available_balance_cents?: number;
    spending_limit: number;
    spent_amount: number;
    remaining_balance: number;
    blocked_merchant_categories?: string[];
    allowed_merchant_categories?: string[];
    currency: string;
    status: 'active' | 'frozen' | 'expired' | 'deleted';
    merchant_restrictions?: {
        allowedCategories?: string[];
        blockedCategories?: string[];
        allowedMerchants?: string[];
        blockedMerchants?: string[];
    };
    expires_at?: Date;
    freeze_reason?: string;
    last_four?: string;
    funding_source_id?: string;
    last_synced_at?: Date;
    creation_fee_amount?: number;
    monthly_fee_amount?: number;
    tier_id_at_creation?: string;
    first_name?: string;
    last_name?: string;
    street_address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    nickname?: string;
    metadata?: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
export interface CreateCardData {
    user_id: string;
    program_id?: number;
    bin?: string;
    name?: string;
    address?: string;
    phone_number?: string;
    exp_month?: string;
    exp_year?: string;
    admediacards_card_id: string;
    card_token: string;
    masked_pan: string;
    card_type: 'single_use' | 'multi_use';
    spending_limit: number;
    remaining_balance: number;
    currency?: string;
    merchant_restrictions?: Card['merchant_restrictions'];
    expires_at?: Date;
    creation_fee_amount?: number;
    monthly_fee_amount?: number;
    tier_id_at_creation?: string;
    first_name?: string;
    last_name?: string;
    street_address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    nickname?: string;
    metadata?: Record<string, any>;
}
export interface UpdateCardData {
    status?: Card['status'];
    spending_limit?: number;
    spent_amount?: number;
    remaining_balance?: number;
    merchant_restrictions?: Card['merchant_restrictions'];
    last_synced_at?: Date;
    metadata?: Record<string, any>;
}
export declare class CardRepository {
    /**
     * Create a new virtual card
     */
    static create(data: CreateCardData): Promise<Card>;
    /**
     * Find a card by ID
     */
    static findById(cardId: string): Promise<Card | null>;
    /**
     * Find a card by card token
     */
    static findByToken(cardToken: string): Promise<Card | null>;
    /**
     * Find all cards for a user
     */
    static findByUserId(userId: string, includeDeleted?: boolean): Promise<Card[]>;
    /**
     * Update a card
     */
    static update(cardId: string, data: UpdateCardData): Promise<Card>;
    /**
     * Update card spending
     */
    static updateSpending(cardId: string, amount: number): Promise<Card>;
    /**
     * Get total active cards balance for a user
     */
    static getUserTotalCardBalance(userId: string): Promise<number>;
    /**
     * Count active cards for a user
     */
    static countActiveCards(userId: string): Promise<number>;
    /**
     * Find all active cards in the system
     */
    static findAllActive(): Promise<Card[]>;
    /**
     * Update last synced timestamp
     */
    static updateLastSyncedAt(cardId: string): Promise<void>;
    /**
     * Update card from Admediacards response
     */
    static updateFromAdmediacards(cardId: string, data: {
        status?: 'active' | 'frozen' | 'expired' | 'deleted';
        remaining_balance?: number;
        spent_amount?: number;
        last_synced_at?: Date;
        metadata?: Record<string, any>;
    }): Promise<Card>;
}
//# sourceMappingURL=cardRepository.d.ts.map