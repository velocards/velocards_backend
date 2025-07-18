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
}