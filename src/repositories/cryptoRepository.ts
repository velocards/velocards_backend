import supabase from '../config/database';
import { DatabaseError } from '../utils/errors';
import { crypto as cryptoConfig } from '../config/env';

export interface XMoneyOrder {
  id: string;
  user_id: string;
  order_reference: string;
  amount: number;
  currency: string;
  crypto_currency?: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  redirect_url?: string;
  callback_url?: string;
  return_url: string;
  cancel_url?: string;
  xmoney_order_id?: string;
  metadata?: any;
  created_at: string;
  updated_at?: string;
}

export interface CryptoTransaction {
  id: string;
  user_id: string;
  xmoney_order_id: string;
  xmoney_payment_id?: string;
  type: 'deposit' | 'withdrawal';
  crypto_currency: string;
  crypto_amount: number;
  fiat_currency: string;
  fiat_amount: number;
  exchange_rate?: number;
  wallet_address?: string;
  transaction_hash?: string;
  confirmations?: number;
  status: 'pending' | 'confirming' | 'completed' | 'failed';
  fee_amount?: number;
  metadata?: any;
  created_at: string;
  updated_at?: string;
}

export interface ExchangeRate {
  from_currency: string;
  to_currency: string;
  rate: number;
  timestamp: string;
}

export interface DepositHistoryItem {
  // Order info (always present)
  orderId: string;
  orderReference: string;
  amount: number;
  currency: string;
  status: string;
  requestedAt: string;
  lastUpdated?: string;
  expiresAt?: string;
  paymentUrl?: string;
  
  // Fee info
  feeInfo?: {
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    feePercentage: number;
  } | null;
  
  // Transaction info (only if completed)
  transactionId?: string | null;
  cryptoCurrency?: string | null;
  cryptoAmount?: number | null;
  exchangeRate?: number | null;
  transactionFeeAmount?: number | null;
  creditedAmount?: number | null;
  completedAt?: string | null;
  transactionHash?: string | null;
  confirmations?: number | null;
  
  // Explorer URLs
  explorerUrls?: {
    transaction?: string;
    address?: string;
  } | null;
  
  // Metadata
  metadata?: any;
}

export class CryptoRepository {
  // XMoney Orders
  static async createOrder(orderData: Partial<XMoneyOrder>): Promise<XMoneyOrder> {
    try {
      const { data, error } = await supabase
        .from('xmoney_orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to create crypto order', error);
    }
  }

  static async getOrderById(orderId: string): Promise<XMoneyOrder | null> {
    try {
      const { data, error } = await supabase
        .from('xmoney_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to get order', error);
    }
  }

  static async getOrderByReference(reference: string): Promise<XMoneyOrder | null> {
    try {
      const { data, error } = await supabase
        .from('xmoney_orders')
        .select('*')
        .eq('order_reference', reference)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to get order by reference', error);
    }
  }

  static async updateOrder(orderId: string, updates: Partial<XMoneyOrder>): Promise<XMoneyOrder> {
    try {
      const { data, error } = await supabase
        .from('xmoney_orders')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to update order', error);
    }
  }

  static async getUserOrders(
    userId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ orders: XMoneyOrder[]; total: number }> {
    try {
      let query = supabase
        .from('xmoney_orders')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.offset !== undefined && filters?.limit) {
        // Use range when both offset and limit are provided
        query = query.range(filters.offset, filters.offset + filters.limit - 1);
      } else if (filters?.limit) {
        // Use limit when only limit is provided
        query = query.limit(filters.limit);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        orders: data || [],
        total: count || 0
      };
    } catch (error: any) {
      throw new DatabaseError('Failed to get user orders', error);
    }
  }

  // Crypto Transactions
  static async createTransaction(txData: Partial<CryptoTransaction>): Promise<CryptoTransaction> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .insert([txData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to create crypto transaction', error);
    }
  }

  static async getTransactionById(transactionId: string): Promise<CryptoTransaction | null> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to get transaction', error);
    }
  }

  static async getTransactionsByOrderId(orderId: string): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('xmoney_order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      throw new DatabaseError('Failed to get transactions by order', error);
    }
  }

  static async getUserPendingDepositsTotal(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('xmoney_orders')
        .select('amount')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .like('order_reference', 'DEP-%');

      if (error) throw error;

      const total = data?.reduce((sum, order) => sum + (parseFloat(order.amount) || 0), 0) || 0;
      return total;
    } catch (error: any) {
      throw new DatabaseError('Failed to get pending deposits total', error);
    }
  }

  static async updateTransaction(
    transactionId: string,
    updates: Partial<CryptoTransaction>
  ): Promise<CryptoTransaction> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to update transaction', error);
    }
  }

  static async getUserDepositHistory(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ transactions: CryptoTransaction[]; total: number }> {
    try {
      let query = supabase
        .from('crypto_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('type', 'deposit')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.offset !== undefined && filters?.limit) {
        // Use range when both offset and limit are provided
        query = query.range(filters.offset, filters.offset + filters.limit - 1);
      } else if (filters?.limit) {
        // Use limit when only limit is provided
        query = query.limit(filters.limit);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        transactions: data || [],
        total: count || 0
      };
    } catch (error: any) {
      throw new DatabaseError('Failed to get deposit history', error);
    }
  }

  // Exchange Rates (for caching)
  static async saveExchangeRate(rateData: ExchangeRate): Promise<void> {
    try {
      const { error } = await supabase
        .from('exchange_rates')
        .upsert([{
          ...rateData,
          id: `${rateData.from_currency}_${rateData.to_currency}`
        }]);

      if (error) throw error;
    } catch (error: any) {
      throw new DatabaseError('Failed to save exchange rate', error);
    }
  }

  static async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate | null> {
    try {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('id', `${fromCurrency}_${toCurrency}`)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Check if rate is still valid
      if (data) {
        const rateAge = Date.now() - new Date(data.timestamp).getTime();
        if (rateAge > cryptoConfig.exchangeRateCacheTtlMs) {
          return null; // Rate is too old
        }
      }

      return data;
    } catch (error: any) {
      throw new DatabaseError('Failed to get exchange rate', error);
    }
  }

  // Withdrawal addresses (for security)
  static async saveWithdrawalAddress(
    userId: string,
    address: string,
    currency: string,
    label?: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('withdrawal_addresses')
        .insert([{
          user_id: userId,
          address,
          currency,
          label,
          is_verified: false
        }]);

      if (error) throw error;
    } catch (error: any) {
      throw new DatabaseError('Failed to save withdrawal address', error);
    }
  }

  static async getUserWithdrawalAddresses(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('withdrawal_addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      throw new DatabaseError('Failed to get withdrawal addresses', error);
    }
  }

  /**
   * Get complete deposit history including pending orders and completed transactions
   * This replaces getUserDepositHistory to show all deposit statuses
   */
  static async getCompleteDepositHistory(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ deposits: DepositHistoryItem[]; total: number }> {
    try {
      // Query orders with optional transaction data
      let query = supabase
        .from('xmoney_orders')
        .select(`
          *,
          crypto_transactions (
            id,
            crypto_currency,
            crypto_amount,
            fiat_amount,
            exchange_rate,
            fee_amount,
            status,
            transaction_hash,
            confirmations,
            created_at
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        if (filters.status === 'completed') {
          // Only orders that have completed transactions
          query = query.not('crypto_transactions', 'is', null);
        } else {
          // Orders with specific status
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.offset !== undefined && filters?.limit) {
        query = query.range(filters.offset, filters.offset + filters.limit - 1);
      } else if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Transform data to unified format
      const deposits: DepositHistoryItem[] = (data || []).map((order: any) => {
        const transaction = order.crypto_transactions?.[0];
        
        // Get explorer URLs from transaction metadata or order metadata
        const explorerUrls = transaction?.metadata?.explorer_urls || order.metadata?.explorer_urls || null;
        
        return {
          // Order info (always present)
          orderId: order.id,
          orderReference: order.order_reference,
          amount: order.amount,
          currency: order.currency,
          status: this.getDisplayStatus(order, transaction),
          requestedAt: order.created_at,
          lastUpdated: order.updated_at,
          expiresAt: order.expires_at,
          paymentUrl: order.redirect_url,
          
          // Fee info from order metadata
          feeInfo: order.metadata?.fee_amount ? {
            grossAmount: order.metadata.gross_amount || order.amount,
            feeAmount: order.metadata.fee_amount || 0,
            netAmount: order.metadata.net_amount || order.amount,
            feePercentage: order.metadata.fee_percentage || 0
          } : null,
          
          // Transaction info (only if completed)
          transactionId: transaction?.id || null,
          cryptoCurrency: transaction?.crypto_currency || order.crypto_currency || null,
          cryptoAmount: transaction?.crypto_amount || null,
          exchangeRate: transaction?.exchange_rate || null,
          transactionFeeAmount: transaction?.fee_amount || null,
          creditedAmount: transaction?.fiat_amount || null,
          completedAt: transaction?.created_at || null,
          transactionHash: transaction?.transaction_hash || order.metadata?.transaction_hash || null,
          confirmations: transaction?.confirmations || null,
          
          // Explorer URLs
          explorerUrls: explorerUrls,
          
          // Metadata
          metadata: order.metadata || {}
        };
      });

      return {
        deposits,
        total: count || 0
      };
    } catch (error: any) {
      throw new DatabaseError('Failed to get complete deposit history', error);
    }
  }

  /**
   * Helper method to determine display status
   */
  private static getDisplayStatus(order: any, transaction: any): string {
    // If we have a completed transaction, show as completed
    if (transaction && transaction.status === 'completed') {
      return 'completed';
    }
    
    // If order is expired and no transaction, show as expired
    if (order.expires_at && new Date(order.expires_at) < new Date() && !transaction) {
      return 'expired';
    }
    
    // Otherwise, use the order status
    return order.status; // 'pending', 'cancelled', etc.
  }
}