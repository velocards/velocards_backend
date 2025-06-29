"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishMonthlyFeesInvoice = exports.publishCardCreatedInvoice = exports.publishFeeInvoice = exports.publishCryptoDepositInvoice = exports.publishCardTransactionInvoice = exports.publishInvoiceEvent = exports.InvoiceEventPublisher = void 0;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("./logger"));
class InvoiceEventPublisher {
    /**
     * Publish an event for invoice generation
     * This is fire-and-forget - we don't wait for invoice generation
     */
    static async publish(event) {
        try {
            // Don't publish events for test/zero amounts unless explicitly configured
            if (event.eventData.amount === 0 && !process.env['INVOICE_INCLUDE_ZERO_AMOUNT']) {
                logger_1.default.debug('Skipping invoice event for zero amount', { event });
                return;
            }
            // Insert into invoice_events table
            const { error } = await database_1.supabase
                .from('invoice_events')
                .insert({
                event_type: event.eventType,
                event_data: event.eventData,
                processed: false,
                retry_count: 0
            });
            if (error) {
                // Log error but don't throw - invoice generation should not block transactions
                logger_1.default.error('Failed to publish invoice event', {
                    error: error.message,
                    event
                });
                return;
            }
            logger_1.default.info('Invoice event published', {
                eventType: event.eventType,
                userId: event.eventData.userId,
                amount: event.eventData.amount
            });
        }
        catch (error) {
            // Never throw - invoice failures should not affect core operations
            logger_1.default.error('Unexpected error publishing invoice event', {
                error: error instanceof Error ? error.message : error,
                event
            });
        }
    }
    /**
     * Publish multiple events in batch
     */
    static async publishBatch(events) {
        if (events.length === 0)
            return;
        try {
            const validEvents = events.filter(event => event.eventData.amount !== 0 || process.env['INVOICE_INCLUDE_ZERO_AMOUNT']);
            if (validEvents.length === 0)
                return;
            const { error } = await database_1.supabase
                .from('invoice_events')
                .insert(validEvents.map(event => ({
                event_type: event.eventType,
                event_data: event.eventData,
                processed: false,
                retry_count: 0
            })));
            if (error) {
                logger_1.default.error('Failed to publish batch invoice events', {
                    error: error.message,
                    eventCount: validEvents.length
                });
                return;
            }
            logger_1.default.info('Batch invoice events published', {
                count: validEvents.length
            });
        }
        catch (error) {
            logger_1.default.error('Unexpected error publishing batch invoice events', {
                error: error instanceof Error ? error.message : error
            });
        }
    }
    /**
     * Helper methods for specific event types
     */
    static async publishCardTransaction(transaction) {
        if (transaction.status !== 'completed')
            return;
        await this.publish({
            eventType: 'card_transaction_completed',
            eventData: {
                userId: transaction.userId,
                amount: transaction.amount,
                currency: transaction.currency,
                transactionId: transaction.id,
                cardId: transaction.cardId,
                merchantName: transaction.merchantName,
                description: `Card transaction at ${transaction.merchantName}`,
                referenceId: transaction.id,
                referenceType: 'transaction'
            }
        });
    }
    static async publishCryptoDeposit(deposit) {
        await this.publish({
            eventType: 'crypto_deposit_completed',
            eventData: {
                userId: deposit.userId,
                amount: deposit.amount,
                currency: deposit.currency,
                description: `${deposit.cryptoCurrency} deposit - ${deposit.cryptoAmount} ${deposit.cryptoCurrency}`,
                referenceId: deposit.id,
                referenceType: 'crypto_deposit',
                cryptoAmount: deposit.cryptoAmount,
                cryptoCurrency: deposit.cryptoCurrency,
                transactionHash: deposit.transactionHash
            }
        });
    }
    static async publishFeeCharged(fee) {
        await this.publish({
            eventType: 'fee_charged',
            eventData: {
                userId: fee.userId,
                amount: fee.amount,
                currency: 'USD',
                feeType: fee.feeType,
                description: fee.description,
                referenceId: fee.referenceId || `fee_${Date.now()}`,
                referenceType: 'fee'
            }
        });
    }
    static async publishCardCreated(card) {
        if (card.creationFee === 0)
            return;
        await this.publish({
            eventType: 'card_created',
            eventData: {
                userId: card.userId,
                amount: card.creationFee,
                currency: 'USD',
                cardId: card.id,
                description: `${card.cardType} card creation fee`,
                referenceId: card.id,
                referenceType: 'card',
                feeType: 'card_creation'
            }
        });
    }
    static async publishMonthlyFees(fees) {
        await this.publish({
            eventType: 'monthly_fee_charged',
            eventData: {
                userId: fees.userId,
                amount: fees.totalAmount,
                currency: 'USD',
                description: `Monthly card fees for ${fees.period}`,
                referenceType: 'monthly_fee',
                feeType: 'monthly',
                feeBreakdown: fees.feeBreakdown,
                period: fees.period
            }
        });
    }
}
exports.InvoiceEventPublisher = InvoiceEventPublisher;
// Export convenience methods
exports.publishInvoiceEvent = InvoiceEventPublisher.publish.bind(InvoiceEventPublisher);
exports.publishCardTransactionInvoice = InvoiceEventPublisher.publishCardTransaction.bind(InvoiceEventPublisher);
exports.publishCryptoDepositInvoice = InvoiceEventPublisher.publishCryptoDeposit.bind(InvoiceEventPublisher);
exports.publishFeeInvoice = InvoiceEventPublisher.publishFeeCharged.bind(InvoiceEventPublisher);
exports.publishCardCreatedInvoice = InvoiceEventPublisher.publishCardCreated.bind(InvoiceEventPublisher);
exports.publishMonthlyFeesInvoice = InvoiceEventPublisher.publishMonthlyFees.bind(InvoiceEventPublisher);
//# sourceMappingURL=invoiceEvents.js.map