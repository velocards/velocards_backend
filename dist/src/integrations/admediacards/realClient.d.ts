import { AdmediacardsAccount, AdmediacardsProfile, AdmediacardsProgram, AdmediacardsCard, AdmediacardsShowPAN, AdmediacardsTransaction, AdmediacardsResponse, CreateCardRequest, CreateCardResponse, UpdateCardRequest, AddCardNoteRequest, AdmediacardsInternalTransaction, AdmediacardsWebhook, WebhookEvent } from './client';
export declare class AdmediacardsRealClient {
    private axios;
    private apiKey;
    private baseUrl;
    private testMode;
    private maxTestCards;
    private accountId;
    constructor();
    private transformError;
    private generateIdempotencyKey;
    testAuth(): Promise<boolean>;
    getAccountBalance(): Promise<AdmediacardsAccount>;
    getAccountProfile(cardLimit?: number): Promise<AdmediacardsProfile>;
    getPrograms(): Promise<AdmediacardsProgram[]>;
    createCard(cardData: CreateCardRequest, idempotencyKey?: string): Promise<AdmediacardsResponse<CreateCardResponse>>;
    getCard(cardId: number): Promise<AdmediacardsCard>;
    showPAN(cardId: number): Promise<AdmediacardsShowPAN>;
    listCards(params?: {
        search?: string;
        search_fields?: string;
        sort_by?: string;
        start_index?: number;
        count?: number;
    }): Promise<AdmediacardsResponse<AdmediacardsCard[]>>;
    updateCard(cardId: number, updateData: UpdateCardRequest): Promise<AdmediacardsResponse<{
        IsApproved: boolean;
        ChangeRequestID: number;
    }>>;
    addCardNote(cardId: number, noteData: AddCardNoteRequest): Promise<void>;
    listTransactions(params?: {
        search?: string;
        search_fields?: string;
        sort_by?: string;
        start_index?: number;
        count?: number;
        tx_date_from_utc?: string;
        tx_date_to_utc?: string;
    }): Promise<AdmediacardsResponse<AdmediacardsTransaction[]>>;
    listCardTransactions(cardId: number): Promise<AdmediacardsTransaction[]>;
    listInternalTransactions(params?: {
        search?: string;
        sort_by?: string;
        start_index?: number;
        count?: number;
    }): Promise<AdmediacardsResponse<AdmediacardsInternalTransaction[]>>;
    listWebhooks(): Promise<AdmediacardsWebhook[]>;
    addWebhook(event: WebhookEvent, payloadUrl: string): Promise<void>;
    updateWebhook(webhookId: number, updates: {
        PayloadURL?: string;
        IsActive?: boolean;
        FailedAttempts?: number;
    }): Promise<void>;
    deleteWebhook(webhookId: number): Promise<void>;
    getWebhookStats(webhookId: number): Promise<any>;
    testWebhook(webhookId: number): Promise<any>;
    getMasterAccountBalance(): Promise<number>;
    syncProgramsToDatabase(): Promise<void>;
}
export declare const admediacardsClient: AdmediacardsRealClient;
//# sourceMappingURL=realClient.d.ts.map