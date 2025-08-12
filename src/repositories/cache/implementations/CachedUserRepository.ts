import { CachedRepository, CacheConfig } from '../CachedRepository'
import { CacheManager, cacheManager } from '../CacheManager'
import { SupabaseClient } from '@supabase/supabase-js'
import logger from '../../../utils/logger'
import { z } from 'zod'

// User entity schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  countryCode: z.string().optional(),
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false),
  kycStatus: z.enum(['pending', 'approved', 'rejected', 'not_started']).optional(),
  created_at: z.date().or(z.string()),
  updated_at: z.date().or(z.string()),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  version: z.number().optional()
})

export type User = z.infer<typeof UserSchema>

export class CachedUserRepository extends CachedRepository<User> {
  private static instance: CachedUserRepository | null = null

  constructor(
    cacheManager: CacheManager,
    cacheConfig?: Partial<CacheConfig>,
    supabaseClient?: SupabaseClient
  ) {
    const defaultConfig: Partial<CacheConfig> = {
      enabled: true,
      ttl: 600, // 10 minutes for user data
      invalidateOnWrite: true,
      warmupOnInit: false,
      cacheNullValues: false
    }

    super('users', cacheManager, { ...defaultConfig, ...cacheConfig }, supabaseClient)
  }

  static getInstance(
    cacheManager?: CacheManager,
    cacheConfig?: Partial<CacheConfig>,
    supabaseClient?: SupabaseClient
  ): CachedUserRepository {
    if (!CachedUserRepository.instance) {
      if (!cacheManager) {
        throw new Error('CacheManager is required for first initialization')
      }
      CachedUserRepository.instance = new CachedUserRepository(
        cacheManager,
        cacheConfig,
        supabaseClient
      )
    }
    return CachedUserRepository.instance
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!this.cacheConfig.enabled) {
      return this.findOne({ email })
    }

    const cacheKey = `findByEmail:${email.toLowerCase()}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => this.findOne({ email }),
      this.getCacheOptions()
    )
  }

  async findByUsername(username: string): Promise<User | null> {
    if (!this.cacheConfig.enabled) {
      return this.findOne({ username })
    }

    const cacheKey = `findByUsername:${username.toLowerCase()}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      () => this.findOne({ username }),
      this.getCacheOptions()
    )
  }

  async findActiveUsers(limit: number = 100): Promise<User[]> {
    if (!this.cacheConfig.enabled) {
      return this.findMany({ isActive: true })
    }

    const cacheKey = `findActiveUsers:${limit}`
    
    return this.cacheManager.wrap(
      this.cacheNamespace,
      cacheKey,
      async () => {
        const users = await this.query({
          where: { isActive: true },
          limit,
          orderBy: [{ field: 'created_at', direction: 'desc' }]
        })
        return users
      },
      { ...this.getCacheOptions(), ttl: 120 } // 2 minutes for active user lists
    )
  }

  async updateUserProfile(
    userId: string,
    profileData: Partial<User>,
    updatedBy?: string
  ): Promise<User> {
    const result = await this.update(userId, profileData, updatedBy)
    
    // Invalidate related caches
    if (this.cacheConfig.enabled) {
      if (profileData.email) {
        await this.cacheManager.invalidate(this.cacheNamespace, `findByEmail:${profileData.email.toLowerCase()}`)
      }
      if (profileData.username) {
        await this.cacheManager.invalidate(this.cacheNamespace, `findByUsername:${profileData.username.toLowerCase()}`)
      }
    }
    
    return result
  }

  async verifyUser(userId: string): Promise<User> {
    const result = await this.update(userId, { isVerified: true })
    
    // Invalidate user-specific caches
    if (this.cacheConfig.enabled) {
      const user = await super.findById(userId)
      if (user) {
        await this.cacheManager.invalidate(this.cacheNamespace, `findByEmail:${user.email.toLowerCase()}`)
        if (user.username) {
          await this.cacheManager.invalidate(this.cacheNamespace, `findByUsername:${user.username.toLowerCase()}`)
        }
      }
    }
    
    return result
  }

  protected override async warmupCache(): Promise<void> {
    try {
      // Warmup recently active users
      const recentUsers = await this.query({
        where: { isActive: true },
        limit: 50,
        orderBy: [{ field: 'updated_at', direction: 'desc' }]
      })

      const cacheItems = recentUsers.map(user => {
        const item: { id: string; data: unknown; ttl?: number } = {
          id: `findById:${user.id}`,
          data: user
        }
        if (this.cacheConfig.ttl !== undefined) {
          item.ttl = this.cacheConfig.ttl
        }
        return item
      })

      if (cacheItems.length > 0) {
        await this.cacheManager.warmup(this.cacheNamespace, cacheItems)
        logger.info({
          message: 'User cache warmed up',
          usersWarmed: cacheItems.length
        })
      }
    } catch (error) {
      logger.error({
        message: 'User cache warmup failed',
        error
      })
    }
  }

  async invalidateUserCaches(userId: string): Promise<void> {
    const user = await super.findById(userId)
    if (user) {
      await this.invalidateEntityCache(userId)
      await this.cacheManager.invalidate(this.cacheNamespace, `findByEmail:${user.email.toLowerCase()}`)
      if (user.username) {
        await this.cacheManager.invalidate(this.cacheNamespace, `findByUsername:${user.username.toLowerCase()}`)
      }
      await this.invalidateListCaches()
    }
  }
}

// Export static methods for backward compatibility with proper initialization
export const cachedUserRepository = {
  findById: (id: string) => CachedUserRepository.getInstance(cacheManager).findById(id),
  findByEmail: (email: string) => CachedUserRepository.getInstance(cacheManager).findByEmail(email),
  findByUsername: (username: string) => CachedUserRepository.getInstance(cacheManager).findByUsername(username),
  findActiveUsers: (limit?: number) => CachedUserRepository.getInstance(cacheManager).findActiveUsers(limit),
  create: (data: Partial<User>, userId?: string) => CachedUserRepository.getInstance(cacheManager).create(data, userId),
  update: (id: string, data: Partial<User>, userId?: string) => CachedUserRepository.getInstance(cacheManager).update(id, data, userId),
  updateUserProfile: (userId: string, profileData: Partial<User>, updatedBy?: string) => 
    CachedUserRepository.getInstance(cacheManager).updateUserProfile(userId, profileData, updatedBy),
  verifyUser: (userId: string) => CachedUserRepository.getInstance(cacheManager).verifyUser(userId),
  delete: (id: string, userId?: string) => CachedUserRepository.getInstance(cacheManager).delete(id, userId),
  invalidateUserCaches: (userId: string) => CachedUserRepository.getInstance(cacheManager).invalidateUserCaches(userId),
  getCacheMetrics: () => CachedUserRepository.getInstance(cacheManager).getCacheMetrics()
}