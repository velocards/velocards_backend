export type InvoiceEventType = 'card_transaction_completed' | 'crypto_deposit_completed' | 'crypto_withdrawal_completed' | 'fee_charged' | 'card_created' | 'monthly_fee_charged';
export interface InvoiceEventData {
    eventType: InvoiceEventType;
    eventData: {
        userId: string;
        amount: number;
        currency?: string;
        description?: string;
        transactionId?: string;
        cardId?: string;
        merchantName?: string;
        feeType?: string;
        referenceId?: string;
        referenceType?: string;
        [key: string]: any;
    };
    priority?: 'high' | 'normal' | 'low';
    metadata?: Record<string, any>;
}
export declare class InvoiceEventPublisher {
    /**
     * Publish an event for invoice generation
     * This is fire-and-forget - we don't wait for invoice generation
     */
    static publish(event: InvoiceEventData): Promise<void>;
    /**
     * Publish multiple events in batch
     */
    static publishBatch(events: InvoiceEventData[]): Promise<void>;
    /**
     * Helper methods for specific event types
     */
    static publishCardTransaction(transaction: {
        id: string;
        userId: string;
        cardId: string;
        amount: number;
        currency: string;
        merchantName: string;
        merchantCategory?: string;
        status: string;
    }): Promise<void>;
    static publishCryptoDeposit(deposit: {
        id: string;
        userId: string;
        amount: number;
        currency: string;
        cryptoAmount: number;
        cryptoCurrency: string;
        transactionHash?: string;
    }): Promise<void>;
    static publishFeeCharged(fee: {
        userId: string;
        amount: number;
        feeType: 'card_creation' | 'monthly' | 'deposit' | 'transaction';
        description: string;
        referenceId?: string;
    }): Promise<void>;
    static publishCardCreated(card: {
        id: string;
        userId: string;
        creationFee: number;
        cardType: string;
    }): Promise<void>;
    static publishMonthlyFees(fees: {
        userId: string;
        totalAmount: number;
        feeBreakdown: Array<{
            cardId: string;
            amount: number;
            cardNumber: string;
        }>;
        period: string;
    }): Promise<void>;
}
export declare const publishInvoiceEvent: typeof InvoiceEventPublisher.publish;
export declare const publishCardTransactionInvoice: typeof InvoiceEventPublisher.publishCardTransaction;
export declare const publishCryptoDepositInvoice: typeof InvoiceEventPublisher.publishCryptoDeposit;
export declare const publishFeeInvoice: typeof InvoiceEventPublisher.publishFeeCharged;
export declare const publishCardCreatedInvoice: typeof InvoiceEventPublisher.publishCardCreated;
export declare const publishMonthlyFeesInvoice: typeof InvoiceEventPublisher.publishMonthlyFees;
//# sourceMappingURL=invoiceEvents.d.ts.map