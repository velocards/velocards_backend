import supabase from '../config/database';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

class DatabaseError extends AppError {
  constructor(message: string, originalError?: any) {
    super('DATABASE_ERROR', message, 500);
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export interface Card {
  id: string;
  user_id: string;
  program_id: number;
  bin: string;
  name: string;
  exp_month: string;
  exp_year: string;
  cvv?: string;
  admediacards_card_id: string;
  card_token: string;
  masked_pan: string;
  card_type: 'single_use' | 'multi_use';
  is_active?: boolean;
  balance_cents?: number;
  available_balance_cents?: number;
  spending_limit: number;
  spent_amount: number;
  remaining_balance: number;
  blocked_merchant_categories?: string[];
  allowed_merchant_categories?: string[];
  currency: string;
  status: 'active' | 'frozen' | 'expired' | 'deleted';
  merchant_restrictions?: {
    allowedCategories?: string[];
    blockedCategories?: string[];
    allowedMerchants?: string[];
    blockedMerchants?: string[];
  };
  expires_at?: Date;
  freeze_reason?: string;
  last_four?: string;
  funding_source_id?: string;
  last_synced_at?: Date;
  creation_fee_amount?: number;
  monthly_fee_amount?: number;
  tier_id_at_creation?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCardData {
  user_id: string;
  program_id?: number;
  bin?: string;
  name?: string;
  exp_month?: string;
  exp_year?: string;
  admediacards_card_id: string;
  card_token: string;
  masked_pan: string;
  card_type: 'single_use' | 'multi_use';
  spending_limit: number;
  remaining_balance: number;
  currency?: string;
  merchant_restrictions?: Card['merchant_restrictions'];
  expires_at?: Date;
  creation_fee_amount?: number;
  monthly_fee_amount?: number;
  tier_id_at_creation?: string;
  metadata?: Record<string, any>;
}

export interface UpdateCardData {
  status?: Card['status'];
  spending_limit?: number;
  spent_amount?: number;
  remaining_balance?: number;
  merchant_restrictions?: Card['merchant_restrictions'];
  last_synced_at?: Date;
  metadata?: Record<string, any>;
}

export class CardRepository {
  /**
   * Create a new virtual card
   */
  static async create(data: CreateCardData): Promise<Card> {
    try {
      // Validate required fields
      if (!data.program_id) {
        throw new Error('Program ID is required for card creation');
      }
      if (!data.bin) {
        throw new Error('BIN is required for card creation');
      }
      if (!data.exp_month || !data.exp_year) {
        throw new Error('Expiry date is required for card creation');
      }
      if (!data.currency) {
        throw new Error('Currency is required for card creation');
      }
      
      const { data: card, error } = await supabase
        .from('virtual_cards')
        .insert({
          ...data,
          program_id: data.program_id,
          bin: data.bin,
          name: data.name || `Virtual Card ${data.card_type}`,
          exp_month: data.exp_month,
          exp_year: data.exp_year,
          is_active: true,
          spent_amount: 0,
          status: 'active',
          currency: data.currency,
          limit_amount: data.spending_limit // Map spending_limit to limit_amount
        })
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Card created for user ${data.user_id}`, { 
        cardId: card.id,
        cardToken: card.card_token 
      });
      
      return card;
    } catch (error: any) {
      logger.error('Failed to create card:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        data: data
      });
      throw new DatabaseError('Failed to create card', error);
    }
  }

  /**
   * Find a card by ID
   */
  static async findById(cardId: string): Promise<Card | null> {
    try {
      const { data, error } = await supabase
        .from('virtual_cards')
        .select('*')
        .eq('id', cardId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data;
    } catch (error: any) {
      logger.error('Failed to find card:', error);
      throw new DatabaseError('Failed to find card', error);
    }
  }

  /**
   * Find a card by card token
   */
  static async findByToken(cardToken: string): Promise<Card | null> {
    try {
      const { data, error } = await supabase
        .from('virtual_cards')
        .select('*')
        .eq('card_token', cardToken)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data;
    } catch (error: any) {
      logger.error('Failed to find card by token:', error);
      throw new DatabaseError('Failed to find card', error);
    }
  }

  /**
   * Find all cards for a user
   */
  static async findByUserId(
    userId: string, 
    includeDeleted: boolean = false
  ): Promise<Card[]> {
    try {
      let query = supabase
        .from('virtual_cards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!includeDeleted) {
        query = query.neq('status', 'deleted');
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return data || [];
    } catch (error: any) {
      logger.error('Failed to find user cards:', error);
      throw new DatabaseError('Failed to find user cards', error);
    }
  }

  /**
   * Update a card
   */
  static async update(cardId: string, data: UpdateCardData): Promise<Card> {
    try {
      const { data: updatedCard, error } = await supabase
        .from('virtual_cards')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Card updated: ${cardId}`, { 
        updates: Object.keys(data) 
      });
      
      return updatedCard;
    } catch (error: any) {
      logger.error('Failed to update card:', error);
      throw new DatabaseError('Failed to update card', error);
    }
  }

  /**
   * Update card spending
   */
  static async updateSpending(
    cardId: string, 
    amount: number
  ): Promise<Card> {
    try {
      // First get the current card
      const card = await this.findById(cardId);
      if (!card) {
        throw new Error('Card not found');
      }

      const newSpentAmount = card.spent_amount + amount;
      const newRemainingBalance = card.spending_limit - newSpentAmount;

      if (newRemainingBalance < 0) {
        throw new Error('Insufficient card balance');
      }

      return await this.update(cardId, {
        spent_amount: newSpentAmount,
        remaining_balance: newRemainingBalance
      });
    } catch (error: any) {
      logger.error('Failed to update card spending:', error);
      throw new DatabaseError('Failed to update card spending', error);
    }
  }

  /**
   * Get total active cards balance for a user
   */
  static async getUserTotalCardBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('virtual_cards')
        .select('remaining_balance')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;

      const total = data?.reduce((sum: number, card: any) => sum + (card.remaining_balance || 0), 0) || 0;
      
      return total;
    } catch (error: any) {
      logger.error('Failed to get user card balance:', error);
      throw new DatabaseError('Failed to get user card balance', error);
    }
  }

  /**
   * Count active cards for a user
   */
  static async countActiveCards(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('virtual_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;
      
      return count || 0;
    } catch (error: any) {
      logger.error('Failed to count active cards:', error);
      throw new DatabaseError('Failed to count active cards', error);
    }
  }

  /**
   * Find all active cards in the system
   */
  static async findAllActive(): Promise<Card[]> {
    try {
      const { data, error } = await supabase
        .from('virtual_cards')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error: any) {
      logger.error('Failed to find all active cards:', error);
      throw new DatabaseError('Failed to find all active cards', error);
    }
  }

  /**
   * Update last synced timestamp
   */
  static async updateLastSyncedAt(cardId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('virtual_cards')
        .update({
          last_synced_at: new Date().toISOString()
        })
        .eq('id', cardId);

      if (error) throw error;
      
      logger.debug(`Updated last sync time for card: ${cardId}`);
    } catch (error: any) {
      logger.error('Failed to update last synced at:', error);
      throw new DatabaseError('Failed to update last synced at', error);
    }
  }

  /**
   * Update card from Admediacards response
   */
  static async updateFromAdmediacards(cardId: string, data: {
    status?: 'active' | 'frozen' | 'expired' | 'deleted';
    remaining_balance?: number;
    spent_amount?: number;
    last_synced_at?: Date;
    metadata?: Record<string, any>;
  }): Promise<Card> {
    try {
      const { data: updatedCard, error } = await supabase
        .from('virtual_cards')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId)
        .select()
        .single();

      if (error) throw error;
      
      logger.info(`Card synced from Admediacards: ${cardId}`);
      
      return updatedCard;
    } catch (error: any) {
      logger.error('Failed to update card from Admediacards:', error);
      throw new DatabaseError('Failed to update card from Admediacards', error);
    }
  }
}