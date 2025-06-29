import { supabase } from '../config/database';
import logger from './logger';

// Type definitions for invoice events
export type InvoiceEventType = 
  | 'card_transaction_completed'
  | 'crypto_deposit_completed'
  | 'crypto_withdrawal_completed'
  | 'fee_charged'
  | 'card_created'
  | 'monthly_fee_charged';

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
    [key: string]: any; // Allow additional fields
  };
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

export class InvoiceEventPublisher {
  /**
   * Publish an event for invoice generation
   * This is fire-and-forget - we don't wait for invoice generation
   */
  static async publish(event: InvoiceEventData): Promise<void> {
    try {
      // Don't publish events for test/zero amounts unless explicitly configured
      if (event.eventData.amount === 0 && !process.env['INVOICE_INCLUDE_ZERO_AMOUNT']) {
        logger.debug('Skipping invoice event for zero amount', { event });
        return;
      }

      // Insert into invoice_events table
      const { error } = await supabase
        .from('invoice_events')
        .insert({
          event_type: event.eventType,
          event_data: event.eventData,
          processed: false,
          retry_count: 0
        });

      if (error) {
        // Log error but don't throw - invoice generation should not block transactions
        logger.error('Failed to publish invoice event', {
          error: error.message,
          event
        });
        return;
      }

      logger.info('Invoice event published', {
        eventType: event.eventType,
        userId: event.eventData.userId,
        amount: event.eventData.amount
      });
    } catch (error) {
      // Never throw - invoice failures should not affect core operations
      logger.error('Unexpected error publishing invoice event', {
        error: error instanceof Error ? error.message : error,
        event
      });
    }
  }

  /**
   * Publish multiple events in batch
   */
  static async publishBatch(events: InvoiceEventData[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const validEvents = events.filter(event => 
        event.eventData.amount !== 0 || process.env['INVOICE_INCLUDE_ZERO_AMOUNT']
      );

      if (validEvents.length === 0) return;

      const { error } = await supabase
        .from('invoice_events')
        .insert(
          validEvents.map(event => ({
            event_type: event.eventType,
            event_data: event.eventData,
            processed: false,
            retry_count: 0
          }))
        );

      if (error) {
        logger.error('Failed to publish batch invoice events', {
          error: error.message,
          eventCount: validEvents.length
        });
        return;
      }

      logger.info('Batch invoice events published', {
        count: validEvents.length
      });
    } catch (error) {
      logger.error('Unexpected error publishing batch invoice events', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Helper methods for specific event types
   */
  static async publishCardTransaction(transaction: {
    id: string;
    userId: string;
    cardId: string;
    amount: number;
    currency: string;
    merchantName: string;
    merchantCategory?: string;
    status: string;
  }): Promise<void> {
    if (transaction.status !== 'completed') return;

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

  static async publishCryptoDeposit(deposit: {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    cryptoAmount: number;
    cryptoCurrency: string;
    transactionHash?: string;
  }): Promise<void> {
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

  static async publishFeeCharged(fee: {
    userId: string;
    amount: number;
    feeType: 'card_creation' | 'monthly' | 'deposit' | 'transaction';
    description: string;
    referenceId?: string;
  }): Promise<void> {
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

  static async publishCardCreated(card: {
    id: string;
    userId: string;
    creationFee: number;
    cardType: string;
  }): Promise<void> {
    if (card.creationFee === 0) return;

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

  static async publishMonthlyFees(fees: {
    userId: string;
    totalAmount: number;
    feeBreakdown: Array<{
      cardId: string;
      amount: number;
      cardNumber: string;
    }>;
    period: string;
  }): Promise<void> {
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

// Export convenience methods
export const publishInvoiceEvent = InvoiceEventPublisher.publish.bind(InvoiceEventPublisher);
export const publishCardTransactionInvoice = InvoiceEventPublisher.publishCardTransaction.bind(InvoiceEventPublisher);
export const publishCryptoDepositInvoice = InvoiceEventPublisher.publishCryptoDeposit.bind(InvoiceEventPublisher);
export const publishFeeInvoice = InvoiceEventPublisher.publishFeeCharged.bind(InvoiceEventPublisher);
export const publishCardCreatedInvoice = InvoiceEventPublisher.publishCardCreated.bind(InvoiceEventPublisher);
export const publishMonthlyFeesInvoice = InvoiceEventPublisher.publishMonthlyFees.bind(InvoiceEventPublisher);