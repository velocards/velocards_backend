import { Card } from '../repositories/cardRepository';
export interface CreateCardInput {
    type: 'single_use' | 'multi_use';
    fundingAmount: number;
    spendingLimit?: number;
    expiresIn?: number;
    programId: number;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    streetAddress: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    nickname?: string;
    merchantRestrictions?: {
        allowedCategories?: string[];
        blockedCategories?: string[];
        allowedMerchants?: string[];
        blockedMerchants?: string[];
    };
}
export interface CardDetails {
    id: string;
    cardToken: string;
    maskedPan: string;
    type: string;
    status: string;
    spendingLimit: number;
    spentAmount: number;
    remainingBalance: number;
    currency: string;
    nickname?: string;
    merchantRestrictions?: Card['merchant_restrictions'];
    expiresAt?: Date;
    createdAt: Date;
}
export interface FullCardDetails {
    id: string;
    cardToken: string;
    pan: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    holderName: string;
    status: string;
    spendingLimit: number;
    spentAmount: number;
    remainingBalance: number;
    createdAt: Date;
}
export interface CardTransaction {
    id: string;
    amount: number;
    currency: string;
    merchantName: string;
    merchantCategory: string;
    status: string;
    timestamp: Date;
}
export interface CardProgram {
    programId: number;
    bin: string;
    name: string;
    description?: string;
}
export declare class CardService {
    /**
     * Get available card programs for selection
     */
    static getAvailablePrograms(): Promise<CardProgram[]>;
    /**
     * Create a new virtual card
     */
    static createCard(userId: string, input: CreateCardInput): Promise<CardDetails>;
    /**
     * Get card details
     */
    static getCard(userId: string, cardId: string): Promise<CardDetails>;
    /**
     * Get full card details including PAN and CVV
     * ⚠️ SECURITY SENSITIVE: This returns unmasked card data
     */
    static getFullCardDetails(userId: string, cardId: string): Promise<FullCardDetails>;
    /**
     * List user's cards
     */
    static listCards(userId: string, includeDeleted?: boolean): Promise<CardDetails[]>;
    /**
     * Freeze a card
     */
    static freezeCard(userId: string, cardId: string): Promise<CardDetails>;
    /**
     * Unfreeze a card
     */
    static unfreezeCard(userId: string, cardId: string): Promise<CardDetails>;
    /**
     * Delete a card
     */
    static deleteCard(userId: string, cardId: string): Promise<void>;
    /**
     * Update card spending limits
     */
    static updateCardLimits(userId: string, cardId: string, newLimit: number): Promise<CardDetails>;
    /**
     * Get card transactions
     */
    static getCardTransactions(userId: string, cardId: string, page?: number, limit?: number): Promise<{
        transactions: CardTransaction[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    /**
     * Helper: Verify card ownership
     */
    private static verifyCardOwnership;
    /**
     * Helper: Generate unique card token
     */
    private static generateCardToken;
    /**
     * Helper: Format card response
     */
    private static formatCardResponse;
}
//# sourceMappingURL=cardService.d.ts.map