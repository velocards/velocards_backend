import { supabase } from '../config/database';
import logger from '../utils/logger';

export interface CryptoTransaction {
  id: string;
  user_id: string;
  xmoney_payment_id: string;
  type: 'deposit' | 'withdrawal';
  crypto_currency: string;
  crypto_amount: number;
  fiat_currency: string;
  fiat_amount: number;
  exchange_rate?: number;
  wallet_address?: string;
  transaction_hash?: string;
  confirmations?: number;
  status: 'pending' | 'confirming' | 'completed' | 'failed' | 'expired';
  fee_amount?: number;
  synced_at?: Date;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCryptoTransactionData {
  user_id: string;
  xmoney_payment_id: string;
  type: 'deposit' | 'withdrawal';
  crypto_currency: string;
  crypto_amount: number;
  fiat_currency: string;
  fiat_amount: number;
  exchange_rate?: number;
  wallet_address?: string;
  status?: 'pending' | 'confirming' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface UpdateCryptoTransactionData {
  status?: 'pending' | 'confirming' | 'completed' | 'failed' | 'expired';
  crypto_amount?: number;
  fiat_amount?: number;
  exchange_rate?: number;
  transaction_hash?: string;
  confirmations?: number;
  fee_amount?: number;
  synced_at?: Date;
  metadata?: Record<string, any>;
}

export class CryptoTransactionRepository {
  static supabase = supabase;

  static async create(data: CreateCryptoTransactionData): Promise<CryptoTransaction> {
    try {
      const { data: transaction, error } = await supabase
        .from('crypto_transactions')
        .insert([{
          user_id: data.user_id,
          xmoney_payment_id: data.xmoney_payment_id,
          type: data.type,
          crypto_currency: data.crypto_currency,
          crypto_amount: data.crypto_amount,
          fiat_currency: data.fiat_currency,
          fiat_amount: data.fiat_amount,
          exchange_rate: data.exchange_rate,
          wallet_address: data.wallet_address,
          status: data.status || 'pending',
          confirmations: 0,
          metadata: data.metadata
        }])
        .select()
        .single();

      if (error) {
        logger.error('Failed to create crypto transaction', { error, data });
        throw new Error(`Failed to create crypto transaction: ${error.message}`);
      }

      return transaction;
    } catch (error: any) {
      logger.error('Error creating crypto transaction', { error: error.message, data });
      throw error;
    }
  }

  static async findById(id: string): Promise<CryptoTransaction | null> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to find crypto transaction by ID', { error, id });
        throw new Error(`Failed to find crypto transaction: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      logger.error('Error finding crypto transaction by ID', { error: error.message, id });
      throw error;
    }
  }

  static async findByXMoneyId(xmoneyPaymentId: string): Promise<CryptoTransaction | null> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('xmoney_payment_id', xmoneyPaymentId)
        .single();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to find crypto transaction by xMoney ID', { error, xmoneyPaymentId });
        throw new Error(`Failed to find crypto transaction: ${error.message}`);
      }

      return data;
    } catch (error: any) {
      logger.error('Error finding crypto transaction by xMoney ID', { error: error.message, xmoneyPaymentId });
      throw error;
    }
  }

  static async findByUserId(userId: string): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to find crypto transactions by user ID', { error, userId });
        throw new Error(`Failed to find crypto transactions: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      logger.error('Error finding crypto transactions by user ID', { error: error.message, userId });
      throw error;
    }
  }

  static async findPendingByUser(userId: string): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'confirming'])
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to find pending crypto transactions', { error, userId });
        throw new Error(`Failed to find pending crypto transactions: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      logger.error('Error finding pending crypto transactions', { error: error.message, userId });
      throw error;
    }
  }

  static async findPendingAfter(cutoffTime: Date): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .in('status', ['pending', 'confirming'])
        .gte('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to find pending crypto transactions after cutoff', { error, cutoffTime });
        throw new Error(`Failed to find pending crypto transactions: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      logger.error('Error finding pending crypto transactions after cutoff', { error: error.message, cutoffTime });
      throw error;
    }
  }

  static async findStuckOrders(cutoffTime: Date): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .eq('status', 'pending')
        .lt('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to find stuck crypto orders', { error, cutoffTime });
        throw new Error(`Failed to find stuck crypto orders: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      logger.error('Error finding stuck crypto orders', { error: error.message, cutoffTime });
      throw error;
    }
  }

  static async findExpiredOrders(cutoffTime: Date): Promise<CryptoTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .in('status', ['pending', 'confirming'])
        .lt('created_at', cutoffTime.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to find expired crypto orders', { error, cutoffTime });
        throw new Error(`Failed to find expired crypto orders: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      logger.error('Error finding expired crypto orders', { error: error.message, cutoffTime });
      throw error;
    }
  }

  static async findInconsistentStates(): Promise<CryptoTransaction[]> {
    try {
      // Find transactions that haven't been synced in over 1 hour but are still pending
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data, error } = await supabase
        .from('crypto_transactions')
        .select('*')
        .in('status', ['pending', 'confirming'])
        .or(`synced_at.is.null,synced_at.lt.${oneHourAgo.toISOString()}`)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to find inconsistent crypto orders', { error });
        throw new Error(`Failed to find inconsistent crypto orders: ${error.message}`);
      }

      return data || [];
    } catch (error: any) {
      logger.error('Error finding inconsistent crypto orders', { error: error.message });
      throw error;
    }
  }

  static async updateFromXMoney(id: string, data: UpdateCryptoTransactionData): Promise<CryptoTransaction> {
    try {
      const { data: transaction, error } = await supabase
        .from('crypto_transactions')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update crypto transaction from xMoney', { error, id, data });
        throw new Error(`Failed to update crypto transaction: ${error.message}`);
      }

      return transaction;
    } catch (error: any) {
      logger.error('Error updating crypto transaction from xMoney', { error: error.message, id, data });
      throw error;
    }
  }

  static async markAsProcessed(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('crypto_transactions')
        .update({
          metadata: { processed_at: new Date().toISOString() },
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error('Failed to mark crypto transaction as processed', { error, id });
        throw new Error(`Failed to mark crypto transaction as processed: ${error.message}`);
      }
    } catch (error: any) {
      logger.error('Error marking crypto transaction as processed', { error: error.message, id });
      throw error;
    }
  }

  static async markAsExpired(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('crypto_transactions')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error('Failed to mark crypto transaction as expired', { error, id });
        throw new Error(`Failed to mark crypto transaction as expired: ${error.message}`);
      }
    } catch (error: any) {
      logger.error('Error marking crypto transaction as expired', { error: error.message, id });
      throw error;
    }
  }
}