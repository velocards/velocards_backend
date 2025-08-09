import supabase from '../config/database';
import logger from '../utils/logger';
import { DatabaseError } from '../utils/errors';

export interface Transaction {
  id: string;
  user_id: string;
  card_id?: string;
  admediacards_transaction_id?: string;
  type: 'authorization' | 'capture' | 'refund' | 'reversal' | 'deposit' | 'withdrawal' | 'fee';
  amount: number;
  currency: string;
  merchant_name?: string;
  merchant_category?: string;
  merchant_country?: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed' | 'disputed';
  response_code?: string;
  response_message?: string;
  dispute_reason?: string;
  dispute_status?: 'pending' | 'resolved' | 'rejected';
  parent_transaction_id?: string;
  synced_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionFilters {
  card_id?: string;
  type?: string;
  status?: string;
  from_date?: Date;
  to_date?: Date;
  min_amount?: number;
  max_amount?: number;
  merchant_name?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: 'created_at' | 'amount';
  orderDirection?: 'asc' | 'desc';
}

export class TransactionRepository {
  /**
   * Get transaction by ID
   */
  static async findById(transactionId: string): Promise<Transaction | null> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      return data;
    } catch (error: any) {
      logger.error('Failed to find transaction:', error);
      throw new DatabaseError('Failed to retrieve transaction', error);
    }
  }

  /**
   * Get transactions for a user with filters and pagination
   */
  static async findByUser(
    userId: string, 
    filters: TransactionFilters = {}, 
    pagination: PaginationOptions
  ): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (filters.card_id) {
        query = query.eq('card_id', filters.card_id);
      }
      if (filters.type) {
        query = query.eq('type', filters.type);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.from_date) {
        query = query.gte('created_at', filters.from_date.toISOString());
      }
      if (filters.to_date) {
        query = query.lte('created_at', filters.to_date.toISOString());
      }
      if (filters.min_amount !== undefined) {
        query = query.gte('amount', filters.min_amount);
      }
      if (filters.max_amount !== undefined) {
        query = query.lte('amount', filters.max_amount);
      }
      if (filters.merchant_name) {
        // Escape special characters in LIKE patterns to prevent injection
        const escapedMerchantName = filters.merchant_name
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/%/g, '\\%')     // Escape percent signs
          .replace(/_/g, '\\_');    // Escape underscores
        query = query.ilike('merchant_name', `%${escapedMerchantName}%`);
      }

      // Apply ordering
      const orderBy = pagination.orderBy || 'created_at';
      const orderDirection = pagination.orderDirection || 'desc';
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });

      // Apply pagination
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        transactions: data || [],
        total: count || 0
      };
    } catch (error: any) {
      logger.error('Failed to find user transactions:', error);
      throw new DatabaseError('Failed to retrieve transactions', error);
    }
  }

  /**
   * Get transactions for a specific card
   */
  static async findByCard(
    cardId: string, 
    pagination: PaginationOptions
  ): Promise<{ transactions: Transaction[]; total: number }> {
    try {
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        transactions: data || [],
        total: count || 0
      };
    } catch (error: any) {
      logger.error('Failed to find card transactions:', error);
      throw new DatabaseError('Failed to retrieve card transactions', error);
    }
  }

  /**
   * Create a new transaction (for mock purposes)
   */
  static async create(data: Partial<Transaction>): Promise<Transaction> {
    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Transaction created`, { 
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount
      });

      return transaction;
    } catch (error: any) {
      logger.error('Failed to create transaction:', error);
      throw new DatabaseError('Failed to create transaction', error);
    }
  }

  /**
   * Update transaction status
   */
  static async updateStatus(
    transactionId: string, 
    status: Transaction['status'],
    additionalData?: Partial<Transaction>
  ): Promise<Transaction> {
    try {
      const updateData: any = { status };
      
      if (additionalData) {
        Object.assign(updateData, additionalData);
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error: any) {
      logger.error('Failed to update transaction status:', error);
      throw new DatabaseError('Failed to update transaction', error);
    }
  }

  /**
   * Create a dispute for a transaction
   */
  static async createDispute(
    transactionId: string,
    reason: string
  ): Promise<Transaction> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({
          status: 'disputed',
          dispute_reason: reason,
          dispute_status: 'pending'
        })
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;

      logger.info(`Transaction disputed`, { transactionId, reason });

      return data;
    } catch (error: any) {
      logger.error('Failed to create dispute:', error);
      throw new DatabaseError('Failed to create dispute', error);
    }
  }

  /**
   * Get transaction statistics for a user
   */
  static async getUserStats(userId: string, period?: { from: Date; to: Date }) {
    try {
      let query = supabase
        .from('transactions')
        .select('type, status, amount, currency')
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (period) {
        query = query
          .gte('created_at', period.from.toISOString())
          .lte('created_at', period.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate statistics
      const stats = {
        totalTransactions: data?.length || 0,
        totalAmount: data?.reduce((sum, tx) => sum + tx.amount, 0) || 0,
        byType: {} as Record<string, number>,
        byCurrency: {} as Record<string, number>
      };

      data?.forEach(tx => {
        stats.byType[tx.type] = (stats.byType[tx.type] || 0) + 1;
        stats.byCurrency[tx.currency] = (stats.byCurrency[tx.currency] || 0) + tx.amount;
      });

      return stats;
    } catch (error: any) {
      logger.error('Failed to get user stats:', error);
      throw new DatabaseError('Failed to retrieve statistics', error);
    }
  }

  /**
   * Sync transaction from Admediacards
   */
  static async syncFromAdmediacards(cardId: string, admediacardsTransaction: any): Promise<Transaction> {
    try {
      // Check if transaction already exists
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('admediacards_transaction_id', admediacardsTransaction.TransactionID)
        .single();

      if (existingTx) {
        // Update existing transaction
        const { data: updated, error } = await supabase
          .from('transactions')
          .update({
            status: this.mapAdmediacardsStatus(admediacardsTransaction.Status),
            response_code: admediacardsTransaction.ResponseCode,
            response_message: admediacardsTransaction.ResponseMessage,
            synced_at: new Date(),
            metadata: {
              ...admediacardsTransaction,
              last_sync: new Date().toISOString()
            }
          })
          .eq('id', existingTx.id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      } else {
        // Get card to find user_id
        const { data: card } = await supabase
          .from('virtual_cards')
          .select('user_id')
          .eq('id', cardId)
          .single();

        if (!card) throw new Error('Card not found');

        // Create new transaction
        const { data: created, error } = await supabase
          .from('transactions')
          .insert({
            user_id: card.user_id,
            card_id: cardId,
            admediacards_transaction_id: admediacardsTransaction.TransactionID,
            type: this.mapAdmediacardsType(admediacardsTransaction.Type),
            amount: admediacardsTransaction.Amount,
            currency: admediacardsTransaction.Currency || 'USD',
            merchant_name: admediacardsTransaction.MerchantName,
            merchant_category: admediacardsTransaction.MerchantCategory,
            merchant_country: admediacardsTransaction.MerchantCountry,
            status: this.mapAdmediacardsStatus(admediacardsTransaction.Status),
            response_code: admediacardsTransaction.ResponseCode,
            response_message: admediacardsTransaction.ResponseMessage,
            synced_at: new Date(),
            metadata: admediacardsTransaction
          })
          .select()
          .single();

        if (error) throw error;
        return created;
      }
    } catch (error: any) {
      logger.error('Failed to sync transaction from Admediacards:', error);
      throw new DatabaseError('Failed to sync transaction', error);
    }
  }

  /**
   * Map Admediacards transaction type to our type
   */
  private static mapAdmediacardsType(type: string): Transaction['type'] {
    const typeMap: Record<string, Transaction['type']> = {
      'AUTHORIZATION': 'authorization',
      'CAPTURE': 'capture',
      'REFUND': 'refund',
      'REVERSAL': 'reversal',
      'AUTHORIZATION_REVERSAL': 'reversal'
    };
    return typeMap[type?.toUpperCase()] || 'authorization';
  }

  /**
   * Map Admediacards status to our status
   */
  private static mapAdmediacardsStatus(status: string): Transaction['status'] {
    const statusMap: Record<string, Transaction['status']> = {
      'APPROVED': 'completed',
      'DECLINED': 'failed',
      'PENDING': 'pending',
      'REVERSED': 'reversed'
    };
    return statusMap[status?.toUpperCase()] || 'pending';
  }
}