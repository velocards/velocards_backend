import { Request } from 'express';
import { supabase } from '../../config/database';
import { LoggerService } from '../logging/loggerService';
import { SecurityLoggingService } from '../securityLoggingService';
import { UserRepository } from '../../repositories/userRepository';
import { v4 as uuidv4 } from 'uuid';

const logger = new LoggerService();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  tier: 'basic' | 'premium' | 'enterprise';
}

export interface RateLimitStatus {
  identifier: string;
  endpoint: string;
  requestCount: number;
  maxRequests: number;
  windowStart: Date;
  windowEnd: Date;
  remainingRequests: number;
  resetTime: Date;
  tier: string;
}

export class RateLimitService {
  // Tier-based rate limit configurations
  private static tierConfigs: Record<string, Record<string, RateLimitConfig>> = {
    basic: {
      default: { windowMs: 15 * 60 * 1000, maxRequests: 300, tier: 'basic' },
      auth: { windowMs: 15 * 60 * 1000, maxRequests: 10, tier: 'basic' },
      cards: { windowMs: 60 * 1000, maxRequests: 5, tier: 'basic' },
      transactions: { windowMs: 60 * 1000, maxRequests: 30, tier: 'basic' },
      export: { windowMs: 60 * 60 * 1000, maxRequests: 3, tier: 'basic' }
    },
    premium: {
      default: { windowMs: 15 * 60 * 1000, maxRequests: 600, tier: 'premium' },
      auth: { windowMs: 15 * 60 * 1000, maxRequests: 20, tier: 'premium' },
      cards: { windowMs: 60 * 1000, maxRequests: 15, tier: 'premium' },
      transactions: { windowMs: 60 * 1000, maxRequests: 60, tier: 'premium' },
      export: { windowMs: 60 * 60 * 1000, maxRequests: 10, tier: 'premium' }
    },
    enterprise: {
      default: { windowMs: 15 * 60 * 1000, maxRequests: 1500, tier: 'enterprise' },
      auth: { windowMs: 15 * 60 * 1000, maxRequests: 50, tier: 'enterprise' },
      cards: { windowMs: 60 * 1000, maxRequests: 50, tier: 'enterprise' },
      transactions: { windowMs: 60 * 1000, maxRequests: 150, tier: 'enterprise' },
      export: { windowMs: 60 * 60 * 1000, maxRequests: 30, tier: 'enterprise' }
    }
  };

  /**
   * Get identifier for rate limiting (user ID or IP)
   */
  private static getIdentifier(req: Request): string {
    const userId = (req as any).user?.id;
    if (userId) {
      return `user:${userId}`;
    }
    
    const ipAddress = SecurityLoggingService.getClientIp(req);
    return `ip:${ipAddress}`;
  }

  /**
   * Get user tier
   */
  private static async getUserTier(userId?: string): Promise<'basic' | 'premium' | 'enterprise'> {
    if (!userId) {
      return 'basic';
    }

    try {
      const user = await UserRepository.findById(userId);
      if (user && user.tier) {
        // Map tier to valid values
        const tierName = typeof user.tier === 'string' ? user.tier : 'basic';
        return tierName as 'basic' | 'premium' | 'enterprise';
      }
    } catch (error) {
      logger.error('Failed to get user tier', error);
    }

    return 'basic';
  }

  /**
   * Get endpoint category from request path
   */
  private static getEndpointCategory(path: string): string {
    if (path.includes('/auth/') || path.includes('/login') || path.includes('/register')) {
      return 'auth';
    }
    if (path.includes('/cards')) {
      return 'cards';
    }
    if (path.includes('/transactions')) {
      return 'transactions';
    }
    if (path.includes('/export')) {
      return 'export';
    }
    return 'default';
  }

  /**
   * Check and track rate limit
   */
  static async checkRateLimit(req: Request): Promise<{
    allowed: boolean;
    status?: RateLimitStatus;
    error?: string;
  }> {
    try {
      const identifier = this.getIdentifier(req);
      const endpoint = this.getEndpointCategory(req.path);
      const userId = (req as any).user?.id;
      const tier = await this.getUserTier(userId);
      
      const config = this.tierConfigs[tier]?.[endpoint] || this.tierConfigs[tier]?.['default'] || this.tierConfigs['basic']?.['default'];
      if (!config) {
        logger.error('No rate limit config found', { tier, endpoint });
        return { allowed: true }; // Fail open
      }
      const now = new Date();
      const windowStart = new Date(now.getTime() - config.windowMs);

      // Check existing rate limit tracking
      const { data: existingTracking, error: fetchError } = await supabase
        .from('rate_limit_tracking')
        .select('*')
        .eq('identifier', identifier)
        .eq('endpoint', endpoint)
        .gte('window_start', windowStart.toISOString())
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Failed to fetch rate limit tracking', fetchError);
        return { allowed: true }; // Fail open
      }

      let requestCount = 1;
      let trackingId = uuidv4();

      if (existingTracking) {
        requestCount = existingTracking.request_count + 1;
        trackingId = existingTracking.id;

        // Check if limit exceeded
        if (requestCount > config.maxRequests) {
          const resetTime = new Date(existingTracking.window_start);
          resetTime.setTime(resetTime.getTime() + config.windowMs);

          const status: RateLimitStatus = {
            identifier,
            endpoint,
            requestCount,
            maxRequests: config.maxRequests,
            windowStart: new Date(existingTracking.window_start),
            windowEnd: resetTime,
            remainingRequests: 0,
            resetTime,
            tier
          };

          // Log rate limit violation
          logger.security(
            'RATE_LIMIT_EXCEEDED',
            'MEDIUM',
            {
              identifier,
              endpoint,
              requestCount,
              maxRequests: config.maxRequests,
              tier
            }
          );

          SecurityLoggingService.logRateLimitViolation(req, endpoint);

          return {
            allowed: false,
            status,
            error: 'Rate limit exceeded'
          };
        }

        // Update tracking
        const { error: updateError } = await supabase
          .from('rate_limit_tracking')
          .update({
            request_count: requestCount,
            updated_at: now.toISOString()
          })
          .eq('id', trackingId);

        if (updateError) {
          logger.error('Failed to update rate limit tracking', updateError);
        }
      } else {
        // Create new tracking
        const { error: insertError } = await supabase
          .from('rate_limit_tracking')
          .insert({
            id: trackingId,
            identifier,
            endpoint,
            window_start: now.toISOString(),
            request_count: 1,
            tier
          });

        if (insertError) {
          logger.error('Failed to create rate limit tracking', insertError);
        }
      }

      const resetTime = new Date(now.getTime() + config.windowMs);
      const status: RateLimitStatus = {
        identifier,
        endpoint,
        requestCount,
        maxRequests: config.maxRequests,
        windowStart: existingTracking ? new Date(existingTracking.window_start) : now,
        windowEnd: resetTime,
        remainingRequests: config.maxRequests - requestCount,
        resetTime,
        tier
      };

      return { allowed: true, status };
    } catch (error) {
      logger.error('Error checking rate limit', error);
      return { allowed: true }; // Fail open
    }
  }

  /**
   * Get rate limit status for a user
   */
  static async getRateLimitStatus(userId: string): Promise<{
    limits: RateLimitStatus[];
    tier: string;
    quotaUsage: Record<string, number>;
  }> {
    try {
      const tier = await this.getUserTier(userId);
      const identifier = `user:${userId}`;
      const now = new Date();
      const limits: RateLimitStatus[] = [];
      const quotaUsage: Record<string, number> = {};

      // Check all endpoint categories
      const endpoints = ['default', 'auth', 'cards', 'transactions', 'export'];

      for (const endpoint of endpoints) {
        const config = this.tierConfigs[tier]?.[endpoint] || this.tierConfigs['basic']?.[endpoint];
        if (!config) continue;
        const windowStart = new Date(now.getTime() - config.windowMs);

        const { data: tracking } = await supabase
          .from('rate_limit_tracking')
          .select('*')
          .eq('identifier', identifier)
          .eq('endpoint', endpoint)
          .gte('window_start', windowStart.toISOString())
          .single();

        const requestCount = tracking?.request_count || 0;
        const resetTime = new Date(now.getTime() + config.windowMs);

        limits.push({
          identifier,
          endpoint,
          requestCount,
          maxRequests: config.maxRequests,
          windowStart: tracking ? new Date(tracking.window_start) : now,
          windowEnd: resetTime,
          remainingRequests: config.maxRequests - requestCount,
          resetTime,
          tier
        });

        quotaUsage[endpoint] = (requestCount / config.maxRequests) * 100;
      }

      return { limits, tier, quotaUsage };
    } catch (error) {
      logger.error('Error getting rate limit status', error);
      return { limits: [], tier: 'basic', quotaUsage: {} };
    }
  }

  /**
   * Clean up old rate limit tracking records
   */
  static async cleanupOldRecords(hoursToKeep: number = 24): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hoursToKeep);

      const { data, error } = await supabase
        .from('rate_limit_tracking')
        .delete()
        .lt('window_start', cutoffDate.toISOString())
        .select();

      if (error) {
        logger.error('Failed to cleanup rate limit records', error);
        return { deletedCount: 0 };
      }

      const deletedCount = data?.length || 0;
      logger.info(`Cleaned up ${deletedCount} old rate limit records`);

      return { deletedCount };
    } catch (error) {
      logger.error('Error cleaning up rate limit records', error);
      return { deletedCount: 0 };
    }
  }

  /**
   * Get rate limit metrics for monitoring
   */
  static async getMetrics(hours: number = 24): Promise<{
    totalRequests: number;
    violationCount: number;
    topUsers: Array<{ identifier: string; requestCount: number }>;
    topEndpoints: Array<{ endpoint: string; requestCount: number }>;
    violationsByEndpoint: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const { data, error } = await supabase
        .from('rate_limit_tracking')
        .select('*')
        .gte('created_at', startDate.toISOString());

      if (error) {
        logger.error('Failed to get rate limit metrics', error);
        return {
          totalRequests: 0,
          violationCount: 0,
          topUsers: [],
          topEndpoints: [],
          violationsByEndpoint: {}
        };
      }

      if (!data || data.length === 0) {
        return {
          totalRequests: 0,
          violationCount: 0,
          topUsers: [],
          topEndpoints: [],
          violationsByEndpoint: {}
        };
      }

      // Calculate metrics
      let totalRequests = 0;
      const userRequests: Record<string, number> = {};
      const endpointRequests: Record<string, number> = {};
      const violations: Record<string, number> = {};

      for (const record of data) {
        totalRequests += record.request_count;
        
        // Track by user
        userRequests[record.identifier] = (userRequests[record.identifier] || 0) + record.request_count;
        
        // Track by endpoint
        endpointRequests[record.endpoint] = (endpointRequests[record.endpoint] || 0) + record.request_count;
        
        // Check for violations
        const tier = record.tier || 'basic';
        const config = this.tierConfigs[tier]?.[record.endpoint] || this.tierConfigs[tier]?.['default'];
        if (config && record.request_count > config.maxRequests) {
          violations[record.endpoint] = (violations[record.endpoint] || 0) + 1;
        }
      }

      // Get top users
      const topUsers = Object.entries(userRequests)
        .map(([identifier, requestCount]) => ({ identifier, requestCount }))
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 10);

      // Get top endpoints
      const topEndpoints = Object.entries(endpointRequests)
        .map(([endpoint, requestCount]) => ({ endpoint, requestCount }))
        .sort((a, b) => b.requestCount - a.requestCount);

      const violationCount = Object.values(violations).reduce((sum, count) => sum + count, 0);

      return {
        totalRequests,
        violationCount,
        topUsers,
        topEndpoints,
        violationsByEndpoint: violations
      };
    } catch (error) {
      logger.error('Error calculating rate limit metrics', error);
      return {
        totalRequests: 0,
        violationCount: 0,
        topUsers: [],
        topEndpoints: [],
        violationsByEndpoint: {}
      };
    }
  }
}