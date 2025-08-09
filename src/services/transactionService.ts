import { 
  TransactionRepository, 
  Transaction, 
  TransactionFilters as TxFilters,
  PaginationOptions as PageOptions 
} from '../repositories/transactionRepository';

// Re-export types for controller use
export type TransactionFilters = TxFilters;
export type PaginationOptions = PageOptions;
import { CardRepository } from '../repositories/cardRepository';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { Parser } from 'json2csv';
import { 
  DisputeTransactionInput as DisputeInput
} from '../api/validators/transactionValidators';

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ExportOptions {
  format: 'csv' | 'json';
  filters?: TransactionFilters;
}

export class TransactionService {
  /**
   * Get user's transaction history with filters
   */
  static async getTransactionHistory(
    userId: string,
    filters: TransactionFilters,
    pagination: PaginationOptions
  ): Promise<TransactionListResponse> {
    try {
      const { transactions, total } = await TransactionRepository.findByUser(
        userId,
        filters,
        pagination
      );

      const totalPages = Math.ceil(total / pagination.limit);

      return {
        transactions,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      logger.error('Failed to get transaction history:', error);
      throw error;
    }
  }

  /**
   * Get specific transaction details
   */
  static async getTransactionDetails(
    userId: string,
    transactionId: string
  ): Promise<Transaction> {
    try {
      const transaction = await TransactionRepository.findById(transactionId);

      if (!transaction) {
        throw new NotFoundError('Transaction');
      }

      // Verify ownership
      if (transaction.user_id !== userId) {
        throw new ForbiddenError('You do not have access to this transaction');
      }

      return transaction;
    } catch (error) {
      logger.error('Failed to get transaction details:', error);
      throw error;
    }
  }

  /**
   * Get transactions for a specific card
   */
  static async getCardTransactions(
    userId: string,
    cardId: string,
    pagination: PaginationOptions
  ): Promise<TransactionListResponse> {
    try {
      // Verify card ownership
      const card = await CardRepository.findById(cardId);
      if (!card) {
        throw new NotFoundError('Card');
      }

      if (card.user_id !== userId) {
        throw new ForbiddenError('You do not have access to this card');
      }

      const { transactions, total } = await TransactionRepository.findByCard(
        cardId,
        pagination
      );

      const totalPages = Math.ceil(total / pagination.limit);

      return {
        transactions,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      logger.error('Failed to get card transactions:', error);
      throw error;
    }
  }

  /**
   * Dispute a transaction
   */
  static async disputeTransaction(
    userId: string,
    transactionId: string,
    input: DisputeInput
  ): Promise<Transaction> {
    try {
      // Validate input
      if (!input.reason || input.reason.trim().length < 10) {
        throw new ValidationError({
          reason: 'Dispute reason must be at least 10 characters'
        });
      }

      // Get transaction and verify ownership
      const transaction = await TransactionRepository.findById(transactionId);
      if (!transaction) {
        throw new NotFoundError('Transaction');
      }

      if (transaction.user_id !== userId) {
        throw new ForbiddenError('You do not have access to this transaction');
      }

      // Check if already disputed
      if (transaction.status === 'disputed') {
        throw new ValidationError({
          status: 'Transaction is already disputed'
        });
      }

      // Check if transaction can be disputed
      if (transaction.status !== 'completed') {
        throw new ValidationError({
          status: 'Only completed transactions can be disputed'
        });
      }

      // Check time limit (e.g., 60 days)
      const daysSinceTransaction = Math.floor(
        (Date.now() - new Date(transaction.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceTransaction > 60) {
        throw new ValidationError({
          time: 'Transactions can only be disputed within 60 days'
        });
      }

      // Create dispute
      const updatedTransaction = await TransactionRepository.createDispute(
        transactionId,
        input.reason
      );

      logger.info('Transaction disputed', {
        userId,
        transactionId,
        reason: input.reason
      });

      return updatedTransaction;
    } catch (error) {
      logger.error('Failed to dispute transaction:', error);
      throw error;
    }
  }

  /**
   * Export transactions in specified format
   */
  static async exportTransactions(
    userId: string,
    options: ExportOptions
  ): Promise<{ data: string; filename: string; contentType: string }> {
    try {
      // Get all transactions (no pagination for export)
      const { transactions } = await TransactionRepository.findByUser(
        userId,
        options.filters || {},
        { page: 1, limit: 10000 } // Max export limit
      );

      if (transactions.length === 0) {
        throw new ValidationError({
          transactions: 'No transactions found to export'
        });
      }

      const timestamp = new Date().toISOString().split('T')[0];
      let data: string;
      let filename: string;
      let contentType: string;

      if (options.format === 'csv') {
        // Prepare data for CSV
        const csvData = transactions.map(tx => ({
          Date: new Date(tx.created_at).toLocaleString(),
          Type: tx.type,
          Amount: tx.amount,
          Currency: tx.currency,
          Status: tx.status,
          'Merchant Name': tx.merchant_name || 'N/A',
          'Merchant Category': tx.merchant_category || 'N/A',
          'Card Last 4': tx.card_id ? 'Card ending ****' : 'N/A',
          'Transaction ID': tx.id
        }));

        const parser = new Parser({
          fields: [
            'Date',
            'Type',
            'Amount',
            'Currency',
            'Status',
            'Merchant Name',
            'Merchant Category',
            'Card Last 4',
            'Transaction ID'
          ]
        });

        data = parser.parse(csvData);
        filename = `transactions_${timestamp}.csv`;
        contentType = 'text/csv';
      } else {
        // JSON format
        data = JSON.stringify(transactions, null, 2);
        filename = `transactions_${timestamp}.json`;
        contentType = 'application/json';
      }

      logger.info('Transactions exported', {
        userId,
        format: options.format,
        count: transactions.length
      });

      return { data, filename, contentType };
    } catch (error) {
      logger.error('Failed to export transactions:', error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  static async getTransactionStats(userId: string, period?: { from: Date; to: Date }) {
    try {
      const stats = await TransactionRepository.getUserStats(userId, period);
      return stats;
    } catch (error) {
      logger.error('Failed to get transaction stats:', error);
      throw error;
    }
  }

  /**
   * Create mock transactions for testing
   */
  static async createMockTransaction(userId: string, cardId: string): Promise<Transaction> {
    const mockMerchants = [
      { name: 'Amazon', category: 'E-commerce' },
      { name: 'Starbucks', category: 'Food & Beverage' },
      { name: 'Uber', category: 'Transportation' },
      { name: 'Netflix', category: 'Entertainment' },
      { name: 'Shell Gas Station', category: 'Gas' }
    ];

    const merchantIndex = Math.floor(Math.random() * mockMerchants.length);
    const merchant = mockMerchants[merchantIndex]!;
    const amount = Math.floor(Math.random() * 200) + 10;

    return await TransactionRepository.create({
      user_id: userId,
      card_id: cardId,
      type: 'capture',
      amount,
      currency: 'USD',
      merchant_name: merchant.name,
      merchant_category: merchant.category,
      merchant_country: 'US',
      status: 'completed',
      response_code: '00',
      response_message: 'Approved',
      admediacards_transaction_id: `amc_tx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    });
  }
}