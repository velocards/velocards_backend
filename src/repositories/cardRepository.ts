import { SupabaseClient } from '@supabase/supabase-js'
import { BaseRepository } from './BaseRepository'
import { AppError } from '../utils/errors'
import logger from '../utils/logger'
import { z } from 'zod'
import { BaseEntity } from './interfaces'

// Card entity schema - extends BaseEntity
export const CardSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  program_id: z.number().int(),
  bin: z.string(),
  name: z.string(),
  address: z.string().optional(),
  phone_number: z.string().optional(),
  exp_month: z.string(),
  exp_year: z.string(),
  cvv: z.string().optional(),
  admediacards_card_id: z.string(),
  card_token: z.string(),
  masked_pan: z.string(),
  card_type: z.enum(['single_use', 'multi_use']),
  is_active: z.boolean().optional(),
  balance_cents: z.number().optional(),
  available_balance_cents: z.number().optional(),
  limit_amount: z.number(), // Note: DB uses limit_amount, not spending_limit
  spending_limit: z.number().optional(), // Added for backward compatibility
  spent_amount: z.number(),
  remaining_balance: z.number(),
  blocked_merchant_categories: z.array(z.string()).optional(),
  allowed_merchant_categories: z.array(z.string()).optional(),
  currency: z.string(),
  status: z.enum(['active', 'frozen', 'expired', 'deleted']),
  merchant_restrictions: z.object({
    allowedCategories: z.array(z.string()).optional(),
    blockedCategories: z.array(z.string()).optional(),
    allowedMerchants: z.array(z.string()).optional(),
    blockedMerchants: z.array(z.string()).optional()
  }).optional(),
  expires_at: z.date().optional(),
  freeze_reason: z.string().optional(),
  last_four: z.string().optional(),
  funding_source_id: z.string().optional(),
  last_synced_at: z.date().optional(),
  creation_fee_amount: z.number().optional(),
  monthly_fee_amount: z.number().optional(),
  tier_id_at_creation: z.string().optional(),
  // Cardholder fields
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  street_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  nickname: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.date(),
  updated_at: z.date(),
  // Version field for optimistic locking
  version: z.number().int().default(0)
})

export type Card = z.infer<typeof CardSchema> & BaseEntity

// Create card data schema
export const CreateCardDataSchema = z.object({
  user_id: z.string().uuid(),
  program_id: z.number().int(),
  bin: z.string(),
  name: z.string().optional(),
  address: z.string().optional(),
  phone_number: z.string().optional(),
  exp_month: z.string(),
  exp_year: z.string(),
  admediacards_card_id: z.string(),
  card_token: z.string(),
  masked_pan: z.string(),
  card_type: z.enum(['single_use', 'multi_use']),
  spending_limit: z.number(), // API uses spending_limit
  remaining_balance: z.number(),
  currency: z.string(),
  merchant_restrictions: z.object({
    allowedCategories: z.array(z.string()).optional(),
    blockedCategories: z.array(z.string()).optional(),
    allowedMerchants: z.array(z.string()).optional(),
    blockedMerchants: z.array(z.string()).optional()
  }).optional(),
  expires_at: z.date().optional(),
  creation_fee_amount: z.number().optional(),
  monthly_fee_amount: z.number().optional(),
  tier_id_at_creation: z.string().optional(),
  // Cardholder fields
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  street_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  nickname: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
})

export type CreateCardData = z.infer<typeof CreateCardDataSchema>

// Update card data schema
export const UpdateCardDataSchema = z.object({
  status: z.enum(['active', 'frozen', 'expired', 'deleted']).optional(),
  spending_limit: z.number().optional(),
  spent_amount: z.number().optional(),
  remaining_balance: z.number().optional(),
  merchant_restrictions: z.object({
    allowedCategories: z.array(z.string()).optional(),
    blockedCategories: z.array(z.string()).optional(),
    allowedMerchants: z.array(z.string()).optional(),
    blockedMerchants: z.array(z.string()).optional()
  }).optional(),
  last_synced_at: z.date().optional(),
  metadata: z.record(z.unknown()).optional()
})

export type UpdateCardData = z.infer<typeof UpdateCardDataSchema>

class CardRepositoryClass extends BaseRepository<Card> {
  constructor(supabaseClient?: SupabaseClient) {
    super('virtual_cards', supabaseClient)
  }

  /**
   * Override base create to handle partial data 
   * This is for interface compatibility
   */
  override async create(data: Partial<Card> | CreateCardData, userId?: string): Promise<Card> {
    // Check if this is a CreateCardData object
    if (this.isCreateCardData(data)) {
      return this.createCard(data as CreateCardData, userId)
    }
    
    // Otherwise, use base implementation for other cases
    return super.create(data as Partial<Card>, userId)
  }

  /**
   * Type guard to check if data is CreateCardData
   */
  private isCreateCardData(data: any): boolean {
    return 'spending_limit' in data && 
           'user_id' in data && 
           'admediacards_card_id' in data &&
           'card_token' in data
  }

  /**
   * Create a new virtual card with validated data
   * Maintains backward compatibility with existing method
   */
  async createCard(data: CreateCardData, userId?: string): Promise<Card> {
    try {
      // Validate input data
      const validatedData = CreateCardDataSchema.parse(data)
      
      // Validate required fields (maintaining existing validation)
      if (!validatedData.program_id) {
        throw new AppError('VALIDATION_ERROR', 'Program ID is required for card creation', 400)
      }
      if (!validatedData.bin) {
        throw new AppError('VALIDATION_ERROR', 'BIN is required for card creation', 400)
      }
      if (!validatedData.exp_month || !validatedData.exp_year) {
        throw new AppError('VALIDATION_ERROR', 'Expiry date is required for card creation', 400)
      }
      if (!validatedData.currency) {
        throw new AppError('VALIDATION_ERROR', 'Currency is required for card creation', 400)
      }

      // Map API field names to DB field names
      const dbData = {
        ...validatedData,
        limit_amount: validatedData.spending_limit, // Map spending_limit to limit_amount
        name: validatedData.name || `Virtual Card ${validatedData.card_type}`,
        is_active: true,
        spent_amount: 0,
        status: 'active' as const,
        version: 0 // Initialize version for optimistic locking
      }

      // Remove spending_limit as it's been mapped to limit_amount
      delete (dbData as any).spending_limit

      this.logAudit('CREATE_CARD', undefined, dbData, userId || validatedData.user_id)

      const result = await super.create(dbData, userId || validatedData.user_id)
      
      // Map limit_amount to spending_limit for backward compatibility
      ;(result as any).spending_limit = result.limit_amount
      
      logger.info(`Card created for user ${validatedData.user_id}`, { 
        cardId: result.id,
        cardToken: result.card_token 
      })
      
      return result
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError('VALIDATION_ERROR', `Invalid card data: ${error.errors[0]?.message}`, 400)
      }
      throw error
    }
  }

  /**
   * Override findById to map limit_amount to spending_limit
   */
  override async findById(id: string): Promise<Card | null> {
    const card = await super.findById(id)
    if (card) {
      // Map limit_amount to spending_limit for backward compatibility
      ;(card as any).spending_limit = card.limit_amount
    }
    return card
  }

  /**
   * Find a card by card token
   */
  async findByToken(cardToken: string): Promise<Card | null> {
    try {
      const card = await this.findOne({ card_token: cardToken })
      if (card) {
        // Map limit_amount to spending_limit for backward compatibility
        ;(card as any).spending_limit = card.limit_amount
      }
      return card
    } catch (error) {
      logger.error('Failed to find card by token:', error)
      throw error
    }
  }

  /**
   * Find all cards for a user
   */
  async findByUserId(userId: string, includeDeleted: boolean = false): Promise<Card[]> {
    try {
      const filters: Record<string, unknown> = { user_id: userId }
      
      let cards: Card[]
      if (!includeDeleted) {
        // Use Supabase's neq operator through custom query
        const query = this.supabase
          .from(this.tableName)
          .select('*')
          .eq('user_id', userId)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false })

        const { data, error } = await query
        
        if (error) throw error
        
        cards = (data || []) as Card[]
      } else {
        // If including deleted, use base findMany
        cards = await this.findMany(filters)
      }

      // Map limit_amount to spending_limit for backward compatibility
      cards.forEach(card => {
        ;(card as any).spending_limit = card.limit_amount
      })

      return cards
    } catch (error) {
      logger.error('Failed to find user cards:', error)
      throw error
    }
  }

  /**
   * Update a card
   * Overrides base update to handle spending_limit mapping
   */
  override async update(cardId: string, data: Partial<Card>, userId?: string): Promise<Card> {
    try {
      // Validate update data
      const validatedData = UpdateCardDataSchema.parse(data)
      
      // Map spending_limit to limit_amount if present
      const dbData: any = { ...validatedData }
      if (validatedData.spending_limit !== undefined) {
        dbData.limit_amount = validatedData.spending_limit
        delete dbData.spending_limit
      }

      // Increment version for optimistic locking
      const currentCard = await this.findById(cardId)
      if (!currentCard) {
        throw new AppError('NOT_FOUND', 'Card not found', 404)
      }
      
      dbData.version = (currentCard.version || 0) + 1

      const result = await super.update(cardId, dbData, userId)
      
      // Map limit_amount to spending_limit for backward compatibility
      ;(result as any).spending_limit = result.limit_amount
      
      logger.info(`Card updated: ${cardId}`, { 
        updates: Object.keys(validatedData) 
      })
      
      return result
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError('VALIDATION_ERROR', `Invalid update data: ${error.errors[0]?.message}`, 400)
      }
      throw error
    }
  }

  /**
   * Update card spending
   */
  async updateSpending(cardId: string, amount: number): Promise<Card> {
    try {
      // Use transaction-like approach with optimistic locking
      const card = await this.findById(cardId)
      if (!card) {
        throw new AppError('NOT_FOUND', 'Card not found', 404)
      }

      const newSpentAmount = card.spent_amount + amount
      const newRemainingBalance = card.limit_amount - newSpentAmount

      if (newRemainingBalance < 0) {
        throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient card balance', 400)
      }

      return await this.update(cardId, {
        spent_amount: newSpentAmount,
        remaining_balance: newRemainingBalance
      })
    } catch (error) {
      logger.error('Failed to update card spending:', error)
      throw error
    }
  }

  /**
   * Get total active cards balance for a user
   */
  async getUserTotalCardBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('remaining_balance')
        .eq('user_id', userId)
        .eq('status', 'active')

      if (error) throw error

      const total = data?.reduce((sum: number, card: any) => 
        sum + (card.remaining_balance || 0), 0) || 0
      
      return total
    } catch (error) {
      logger.error('Failed to get user card balance:', error)
      throw this.mapDatabaseError(error)
    }
  }

  /**
   * Count active cards for a user
   */
  async countActiveCards(userId: string): Promise<number> {
    try {
      return await this.count({ user_id: userId, status: 'active' })
    } catch (error) {
      logger.error('Failed to count active cards:', error)
      throw error
    }
  }

  /**
   * Find all active cards in the system
   */
  async findAllActive(): Promise<Card[]> {
    try {
      const cards = await this.findAll({
        status: 'active',
        sortBy: 'created_at',
        sortOrder: 'desc'
      })
      
      // Map limit_amount to spending_limit for backward compatibility
      cards.forEach(card => {
        ;(card as any).spending_limit = card.limit_amount
      })
      
      return cards
    } catch (error) {
      logger.error('Failed to find all active cards:', error)
      throw error
    }
  }

  /**
   * Update last synced timestamp
   */
  async updateLastSyncedAt(cardId: string): Promise<void> {
    try {
      await this.update(cardId, {
        last_synced_at: new Date()
      })
      
      logger.debug(`Updated last sync time for card: ${cardId}`)
    } catch (error) {
      logger.error('Failed to update last synced at:', error)
      throw error
    }
  }

  /**
   * Update card from Admediacards response
   */
  async updateFromAdmediacards(cardId: string, data: {
    status?: 'active' | 'frozen' | 'expired' | 'deleted'
    remaining_balance?: number
    spent_amount?: number
    last_synced_at?: Date
    metadata?: Record<string, any>
  }): Promise<Card> {
    try {
      const result = await this.update(cardId, {
        ...data,
        last_synced_at: new Date()
      })
      
      logger.info(`Card synced from Admediacards: ${cardId}`)
      
      return result
    } catch (error) {
      logger.error('Failed to update card from Admediacards:', error)
      throw error
    }
  }
}

// Export singleton instance for backward compatibility
export const CardRepository = new CardRepositoryClass()