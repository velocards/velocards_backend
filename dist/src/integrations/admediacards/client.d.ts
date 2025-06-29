export interface AdmediacardsAccount {
    PrepayAmount: number;
    TotalSpend: number;
    FeesAmount: number;
    PrepayBalance: number;
}
export interface AdmediacardsProfile {
    PrepayThresholdEnum: 'Percent' | 'Flat';
    PrepayThresholdValue: number;
    CurrentBalance: number;
    AllowedCardLimit: number;
    FundRequired: number;
    TotalCardBalance: number;
    AutoApprovedLimit: number;
    CardNumberLimit: number;
    ActiveCardNumber: number;
    CardNumberLeft: number;
    IsCardRequestAllowed: boolean;
    IsChangeRequestAllowed: boolean;
    XDaySpend: number;
    XDayProjectedSpend: number;
}
export interface AdmediacardsProgram {
    ProgramID: number;
    BIN: string;
    Name: string;
    DateEnteredUtc: string;
}
export interface AdmediacardsCard {
    CardID: number;
    Name: string;
    Limit: number;
    ProgramID: number;
    BIN: string;
    Last4: string;
    Balance: number;
    Address: string;
    IsActive: boolean;
    ClientNote: string | null;
    Currency: string;
    ExpMonth: string;
    ExpYear: string;
    Spend: number;
    PhoneNumber: string;
    DateEnteredUtc: string;
}
export interface AdmediacardsShowPAN {
    CardID?: number;
    CcNum: string;
    Cvx2: string;
    ExpMonth: string;
    ExpYear: string;
    PAN?: string;
    CVV?: string;
}
export interface AdmediacardsTransaction {
    TransactionID: number;
    ParentTransactionID: number | null;
    CardID: number;
    Response: 'approved' | 'declined';
    ResponseText: string;
    Merchant: string;
    Amount: number;
    TxDateTimeIso: number;
    TypeEnum: 'Authorization' | 'Settlement' | 'Refund';
    IsTemp: boolean;
    Country: string;
}
export interface AdmediacardsResponse<T> {
    Status: number;
    Good: boolean;
    Result: T;
    Metadata?: {
        Count: number;
        TotalCount: number;
        TotalPages: number;
        StartIndex: number;
        EndIndex: number | null;
        IsMore: boolean;
    };
}
export interface CreateCardRequest {
    ProgramID: number;
    Limit: number;
    FirstName: string;
    LastName: string;
    Address1: string;
    City: string;
    State: string;
    Zip: string;
    CountryIso: string;
    ExpMonth: string;
    ExpYear: string;
    PhoneNumber: string;
}
export interface CreateCardResponse {
    IsApproved: boolean;
    CardID: number;
    ChangeRequestID: number;
}
export interface UpdateCardRequest {
    Type: 'Limit' | 'NameAddress' | 'Status';
    Limit?: number;
    Status?: boolean;
    FirstName?: string;
    LastName?: string;
    Address1?: string;
    City?: string;
    State?: string;
    Country?: string;
    Zip?: string;
}
export interface AddCardNoteRequest {
    Note: string;
}
export interface AdmediacardsInternalTransaction {
    TransactionID: number;
    CardID: number | null;
    TypeEnum: 'Wire' | 'Fee';
    Amount: number;
    TransactionDate: number;
    Description: string;
    DateEnteredUtc: number;
}
export interface AdmediacardsWebhook {
    WebHookID: number;
    PayloadURL: string;
    FailedAttempts: number;
    NextRunUtc: number | null;
    IsActive: boolean;
    Event: WebhookEvent;
}
export type WebhookEvent = 'CardAdded' | 'InternalTransactionAdded' | 'TransactionAdded';
export interface AdmediacardsWebhookPayload {
    CardID?: number;
    Limit?: number;
    BIN?: string;
    Last4?: string;
    FirstName?: string;
    LastName?: string;
    Address1?: string;
    City?: string;
    State?: string;
    Zip?: string;
    CountryIso?: string;
    ExpMonth?: string;
    ExpYear?: string;
    Balance?: number;
    TransactionID?: number;
    Amount?: number;
    LocalAmount?: number;
    LocalCurrency?: string;
    Merchant?: string;
    Country?: string;
    TransactionDateTime?: string;
    Response?: string;
    ResponseText?: string;
    IsTemp?: boolean;
    TypeEnum?: string;
}
export declare class AdmediacardsClient {
    private apiKey;
    private baseUrl;
    private axiosInstance;
    private isLive;
    private mockCards;
    private mockTransactions;
    private mockAccount;
    private mockProfile;
    private mockPrograms;
    private cardIdCounter;
    private transactionIdCounter;
    constructor(config: {
        apiKey: string;
        baseUrl?: string;
        isLive?: boolean;
    });
    private initializeMockData;
    /**
     * Test API authentication
     */
    testAuth(): Promise<AdmediacardsResponse<{}>>;
    /**
     * Get account balance
     */
    getBalance(): Promise<AdmediacardsResponse<AdmediacardsAccount>>;
    /**
     * Get account profile
     */
    getProfile(): Promise<AdmediacardsResponse<AdmediacardsProfile>>;
    /**
     * Get available programs
     */
    getPrograms(): Promise<AdmediacardsResponse<AdmediacardsProgram[]>>;
    /**
     * Create a new card
     */
    createCard(cardData: CreateCardRequest, idempotencyKey?: string): Promise<AdmediacardsResponse<CreateCardResponse>>;
    /**
     * Get a specific card
     */
    getCard(cardId: number): Promise<AdmediacardsCard>;
    /**
     * Get full card details including PAN and CVV
     */
    showPAN(cardId: number): Promise<AdmediacardsShowPAN>;
    /**
     * List cards with pagination and search
     */
    listCards(params?: {
        search?: string;
        search_fields?: string;
        sort_by?: string;
        start_index?: number;
        count?: number;
    }): Promise<AdmediacardsResponse<AdmediacardsCard[]>>;
    /**
     * Update card (limits, status, address)
     */
    updateCard(cardId: number, updateData: UpdateCardRequest, idempotencyKey?: string): Promise<AdmediacardsResponse<{
        IsApproved: boolean;
        ChangeRequestID: number;
    }>>;
    /**
     * Add a note to a card
     */
    addCardNote(cardId: number, noteData: AddCardNoteRequest): Promise<void>;
    /**
     * Get transactions
     */
    getTransactions(params?: {
        tx_date_from_utc?: string;
        tx_date_to_utc?: string;
        search?: string;
        sort_by?: string;
        start_index?: number;
        count?: number;
    }): Promise<AdmediacardsResponse<AdmediacardsTransaction[]>>;
    /**
     * Get card transactions
     */
    getCardTransactions(cardId: number): Promise<AdmediacardsResponse<AdmediacardsTransaction[]>>;
    /**
     * Simulate a transaction (for testing)
     */
    simulateTransaction(params: {
        cardId: number;
        amount: number;
        merchant: string;
        country?: string;
        isApproved?: boolean;
    }): Promise<AdmediacardsTransaction>;
    /**
     * Simulate webhook (for testing)
     */
    simulateWebhook(type: 'CardAdded' | 'TransactionAdded', data: AdmediacardsWebhookPayload): AdmediacardsWebhookPayload;
    /**
     * Get master account balance
     * This is the total balance for our entire platform, not individual users
     */
    getMasterAccountBalance(): Promise<number>;
    /**
     * Generate idempotency key for API requests
     */
    private generateIdempotencyKey;
}
export declare function getAdmediacardsClient(): AdmediacardsClient;
//# sourceMappingURL=client.d.ts.map