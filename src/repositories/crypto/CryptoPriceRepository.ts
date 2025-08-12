import { BaseRepository } from '../BaseRepository'
import { supabase } from '../../config/database'
import { AppError } from '../../utils/errors'
import { BaseEntity } from '../interfaces'
import logger from '../../utils/logger'
import { crypto as cryptoConfig } from '../../config/env'

export interface CryptoPrice extends BaseEntity {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  source: string
  timestamp: Date
  expires_at?: Date
  metadata?: Record<string, unknown>
}

export interface ExchangeRateCache {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  cached_at: Date
  expires_at: Date
  source: string
}

export class CryptoPriceRepository extends BaseRepository<CryptoPrice> {
  private cacheExpiry: number = cryptoConfig?.exchangeRateCacheTtlMs || 300000

  constructor() {
    super('crypto_prices', supabase)
  }

  async getCachedPrice(
    fromCurrency: string,
    toCurrency: string
  ): Promise<CryptoPrice | null> {
    try {
      const cacheKey = `${fromCurrency}_${toCurrency}`
      
      const cached = await this.findOne({
        id: cacheKey
      })

      if (!cached) {
        return null
      }

      const now = new Date()
      const expiresAt = cached.expires_at ? new Date(cached.expires_at) : null

      if (expiresAt && expiresAt < now) {
        logger.info(`Cache expired for ${cacheKey}`)
        await this.delete(cached.id)
        return null
      }

      this.logAudit('PRICE_CACHE_HIT', cacheKey, { fromCurrency, toCurrency })
      
      return cached
    } catch (error) {
      logger.error('Error getting cached price', error)
      return null
    }
  }

  async setCachedPrice(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    source: string = 'xmoney'
  ): Promise<CryptoPrice> {
    try {
      const cacheKey = `${fromCurrency}_${toCurrency}`
      const now = new Date()
      const expiresAt = new Date(now.getTime() + this.cacheExpiry)

      const priceData: Partial<CryptoPrice> = {
        id: cacheKey,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate,
        source,
        timestamp: now,
        expires_at: expiresAt,
        metadata: {
          cached: true,
          cache_ttl_ms: this.cacheExpiry
        }
      }

      const existing = await this.findById(cacheKey)

      let result: CryptoPrice
      if (existing) {
        result = await this.update(cacheKey, priceData)
      } else {
        result = await this.create(priceData)
      }

      this.logAudit('PRICE_CACHE_SET', cacheKey, { fromCurrency, toCurrency, rate })

      return result
    } catch (error) {
      logger.error('Error setting cached price', error)
      throw error
    }
  }

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ rate: number; cached: boolean } | null> {
    try {
      const cached = await this.getCachedPrice(fromCurrency, toCurrency)

      if (cached) {
        return {
          rate: cached.rate,
          cached: true
        }
      }

      return null
    } catch (error) {
      logger.error('Error getting exchange rate', error)
      return null
    }
  }

  async saveExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    source?: string
  ): Promise<void> {
    try {
      await this.setCachedPrice(fromCurrency, toCurrency, rate, source)
    } catch (error) {
      logger.error('Error saving exchange rate', error)
      throw error
    }
  }

  async getPriceHistory(
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<CryptoPrice[]> {
    try {
      const { data, error } = await this.supabase
        .from('crypto_price_history')
        .select('*')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return (data || []) as CryptoPrice[]
    } catch (error) {
      logger.error('Error getting price history', error)
      throw error
    }
  }

  async recordPriceHistory(price: CryptoPrice): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('crypto_price_history')
        .insert({
          from_currency: price.from_currency,
          to_currency: price.to_currency,
          rate: price.rate,
          source: price.source,
          timestamp: price.timestamp
        })

      if (error) {
        logger.error('Error recording price history', error)
      }
    } catch (error) {
      logger.error('Error recording price history', error)
    }
  }

  async cleanupExpiredCache(): Promise<number> {
    try {
      const now = new Date()

      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt('expires_at', now.toISOString())
        .select()

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      const deletedCount = data?.length || 0
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired price cache entries`)
      }

      return deletedCount
    } catch (error) {
      logger.error('Error cleaning up expired cache', error)
      return 0
    }
  }

  async getLatestPrices(currencies: string[]): Promise<Map<string, number>> {
    try {
      const priceMap = new Map<string, number>()
      
      if (currencies.length === 0) {
        return priceMap
      }

      // Batch fetch all prices in a single query for better performance
      const cacheKeys = currencies.map(currency => `${currency}_USD`)
      
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .in('id', cacheKeys)
        .gte('expires_at', new Date().toISOString())
      
      if (error) {
        logger.error('Error batch fetching prices', error)
        // Fallback to individual fetches
        for (const currency of currencies) {
          const price = await this.getCachedPrice(currency, 'USD')
          if (price) {
            priceMap.set(currency, price.rate)
          }
        }
      } else if (data) {
        for (const price of data) {
          priceMap.set(price.from_currency, price.rate)
        }
        
        // Log cache hit rate for monitoring
        const hitRate = (data.length / currencies.length) * 100
        if (hitRate < 80) {
          logger.warn(`Low cache hit rate for batch price fetch: ${hitRate.toFixed(1)}%`)
        }
      }

      return priceMap
    } catch (error) {
      logger.error('Error getting latest prices', error)
      return new Map()
    }
  }

  async invalidateCache(fromCurrency?: string, toCurrency?: string): Promise<void> {
    try {
      if (fromCurrency && toCurrency) {
        const cacheKey = `${fromCurrency}_${toCurrency}`
        await this.delete(cacheKey)
        logger.info(`Invalidated cache for ${cacheKey}`)
      } else if (fromCurrency) {
        const { data } = await this.supabase
          .from(this.tableName)
          .delete()
          .eq('from_currency', fromCurrency)
          .select()
        
        logger.info(`Invalidated ${data?.length || 0} cache entries for ${fromCurrency}`)
      } else {
        const { data } = await this.supabase
          .from(this.tableName)
          .delete()
          .neq('id', '')
          .select()
        
        logger.info(`Invalidated all ${data?.length || 0} cache entries`)
      }
    } catch (error) {
      logger.error('Error invalidating cache', error)
      throw error
    }
  }

  setCacheExpiry(milliseconds: number): void {
    this.cacheExpiry = milliseconds
    logger.info(`Cache expiry set to ${milliseconds}ms`)
  }
}