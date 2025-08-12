import { CachedRepository, CacheConfig } from '../CachedRepository'
import { CacheManager } from '../CacheManager'
import { SupabaseClient } from '@supabase/supabase-js'
import logger from '../../../utils/logger'
import { z } from 'zod'

// Card entity schema
const CardSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  card_number_hash: z.string(),
  last_four: z.string(),
  status: z.enum(['active', 'inactive', 'suspended', 'expired']),
  card_type: z.enum(['virtual', 'physical']),
  currency: z.string(),
  limit_amount: z.number(),
  available_balance: z.number(),
  expiry_date: z.string(),
  created_at: z.date().or(z.string()),
  updated_at: z.date().or(z.string()),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  version: z.number().optional()
})

export type Card = z.infer<typeof CardSchema>

export class CachedCardRepository extends CachedRepository<Card> {
  private static instance: CachedCardRepository | null = null

  constructor(
    cacheManager: CacheManager,
    cacheConfig?: Partial<CacheConfig>,
    supabaseClient?: SupabaseClient
  ) {
    const defaultConfig: Partial<CacheConfig> = {
      enabled: true,
      ttl: 300, // 5 minutes for card data
      invalidateOnWrite: true,
      warmupOnInit: false,
      cacheNullValues: false
    }

    super('cards', cacheManager, { ...defaultConfig, ...cacheConfig }, supabaseClient)
  }

  static getInstance(
    cacheManager?: CacheManager,
    cacheConfig?: Partial<CacheConfig>,
    supabaseClient?: SupabaseClient
  ): CachedCardRepository {
    if (!CachedCardRepository.instance) {
      if (!cacheManager) {
        throw new Error('CacheManager is required for first initialization')
      }
      CachedCardRepository.instance = new CachedCardRepository(
        cacheManager,
        cacheConfig,
        supabaseClient
      )
    }
    return CachedCardRepository.instance
  }

  async findByUserId(userId: string): Promise<Card[]> {
    if (!this.cacheConfig.enabled) {
      return this.findMany({ user_id: userId })
    }

    const cacheKey = `findByUserId:${userId}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => this.findMany({ user_id: userId }),
      { ...this.getCacheOptions(), ttl: 180 } // 3 minutes for user's cards
    )
  }

  async findActiveCardsByUserId(userId: string): Promise<Card[]> {
    if (!this.cacheConfig.enabled) {
      return this.query({
        where: { user_id: userId, status: 'active' },
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      })
    }

    const cacheKey = `findActiveByUserId:${userId}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => this.query({
        where: { user_id: userId, status: 'active' },
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      }),
      { ...this.getCacheOptions(), ttl: 180 } // 3 minutes
    )
  }

  async findByCardHash(cardNumberHash: string): Promise<Card | null> {
    if (!this.cacheConfig.enabled) {
      return this.findOne({ card_number_hash: cardNumberHash })
    }

    const cacheKey = `findByHash:${cardNumberHash.substring(0, 16)}` // Use partial hash for cache key
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => this.findOne({ card_number_hash: cardNumberHash }),
      this.getCacheOptions()
    )
  }

  async updateCardStatus(
    cardId: string,
    status: Card['status'],
    updatedBy?: string
  ): Promise<Card> {
    const result = await this.update(cardId, { status }, updatedBy)
    
    // Invalidate user's card caches
    if (this.cacheConfig.enabled) {
      await this.invalidateUserCardCaches(result.user_id)
    }
    
    return result
  }

  async updateCardBalance(
    cardId: string,
    availableBalance: number,
    updatedBy?: string
  ): Promise<Card> {
    const result = await this.update(cardId, { available_balance: availableBalance }, updatedBy)
    
    // Invalidate card caches but not lists (balance updates are frequent)
    if (this.cacheConfig.enabled) {
      await this.invalidateEntityCache(cardId)
      const card = await super.findById(cardId)
      if (card) {
        await this.cacheManager.invalidate(this.cacheNamespace, `findByHash:${card.card_number_hash.substring(0, 16)}`)
      }
    }
    
    return result
  }

  async getCardStats(userId: string): Promise<{
    totalCards: number
    activeCards: number
    totalBalance: number
    totalLimit: number
  }> {
    if (!this.cacheConfig.enabled) {
      return this.calculateCardStats(userId)
    }

    const cacheKey = `stats:${userId}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => this.calculateCardStats(userId),
      { ...this.getCacheOptions(), ttl: 60 } // 1 minute for stats
    )
  }

  private async calculateCardStats(userId: string) {
    const cards = await this.findByUserId(userId)
    const activeCards = cards.filter(c => c.status === 'active')
    
    return {
      totalCards: cards.length,
      activeCards: activeCards.length,
      totalBalance: activeCards.reduce((sum, c) => sum + c.available_balance, 0),
      totalLimit: activeCards.reduce((sum, c) => sum + c.limit_amount, 0)
    }
  }

  protected override async warmupCache(): Promise<void> {
    try {
      // Warmup recently active cards
      const recentCards = await this.query({
        where: { status: 'active' },
        limit: 100,
        orderBy: [{ field: 'updated_at', direction: 'desc' }]
      })

      const cacheItems = recentCards.map(card => {
        const item: { id: string; data: unknown; ttl?: number } = {
          id: `findById:${card.id}`,
          data: card
        }
        if (this.cacheConfig.ttl !== undefined) {
          item.ttl = this.cacheConfig.ttl
        }
        return item
      })

      if (cacheItems.length > 0) {
        await this.cacheManager.warmup(this.cacheNamespace, cacheItems)
        logger.info({
          message: 'Card cache warmed up',
          cardsWarmed: cacheItems.length
        })
      }
    } catch (error) {
      logger.error({
        message: 'Card cache warmup failed',
        error
      })
    }
  }

  async invalidateUserCardCaches(userId: string): Promise<void> {
    await this.cacheManager.invalidate(this.cacheNamespace, `findByUserId:${userId}`)
    await this.cacheManager.invalidate(this.cacheNamespace, `findActiveByUserId:${userId}`)
    await this.cacheManager.invalidate(this.cacheNamespace, `stats:${userId}`)
  }

  async invalidateCardCaches(cardId: string): Promise<void> {
    const card = await super.findById(cardId)
    if (card) {
      await this.invalidateEntityCache(cardId)
      await this.invalidateUserCardCaches(card.user_id)
      await this.cacheManager.invalidate(this.cacheNamespace, `findByHash:${card.card_number_hash.substring(0, 16)}`)
    }
  }
}

// Export static methods for backward compatibility
export const cachedCardRepository = {
  findById: (id: string) => CachedCardRepository.getInstance().findById(id),
  findByUserId: (userId: string) => CachedCardRepository.getInstance().findByUserId(userId),
  findActiveCardsByUserId: (userId: string) => CachedCardRepository.getInstance().findActiveCardsByUserId(userId),
  findByCardHash: (cardNumberHash: string) => CachedCardRepository.getInstance().findByCardHash(cardNumberHash),
  create: (data: Partial<Card>, userId?: string) => CachedCardRepository.getInstance().create(data, userId),
  update: (id: string, data: Partial<Card>, userId?: string) => CachedCardRepository.getInstance().update(id, data, userId),
  updateCardStatus: (cardId: string, status: Card['status'], updatedBy?: string) => 
    CachedCardRepository.getInstance().updateCardStatus(cardId, status, updatedBy),
  updateCardBalance: (cardId: string, availableBalance: number, updatedBy?: string) => 
    CachedCardRepository.getInstance().updateCardBalance(cardId, availableBalance, updatedBy),
  getCardStats: (userId: string) => CachedCardRepository.getInstance().getCardStats(userId),
  delete: (id: string, userId?: string) => CachedCardRepository.getInstance().delete(id, userId),
  invalidateCardCaches: (cardId: string) => CachedCardRepository.getInstance().invalidateCardCaches(cardId),
  getCacheMetrics: () => CachedCardRepository.getInstance().getCacheMetrics()
}