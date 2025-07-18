import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import redis from '../config/redis';
import { CardRepository } from '../repositories/cardRepository';
import { ValidationError, ForbiddenError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export interface CardSession {
  sessionId: string;
  userId: string;
  cardId: string;
  purpose: 'view_pan' | 'view_cvv' | 'view_full';
  token: string;
  ip: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
}

export class CardSessionService {
  private static SESSION_PREFIX = 'card_session:';
  private static SESSION_TTL = 300; // 5 minutes
  
  /**
   * Create a secure session for accessing card details
   */
  static async createSession(
    userId: string,
    cardId: string,
    purpose: 'view_pan' | 'view_cvv' | 'view_full',
    ip: string,
    userAgent?: string
  ): Promise<{ sessionId: string; token: string }> {
    // Verify card ownership
    const card = await CardRepository.findById(cardId);
    
    if (!card) {
      throw new NotFoundError('Card not found');
    }
    
    if (card.user_id !== userId) {
      throw new ForbiddenError('Access denied');
    }
    
    // Only allow for active cards
    if (card.status !== 'active') {
      throw new ValidationError('Can only access details for active cards');
    }
    
    // Generate session ID and token
    const sessionId = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    
    const session: CardSession = {
      sessionId,
      userId,
      cardId,
      purpose,
      token,
      ip,
      ...(userAgent && { userAgent }),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.SESSION_TTL * 1000).toISOString()
    };
    
    try {
      // Store session in Redis
      await redis.setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.SESSION_TTL,
        JSON.stringify(session)
      );
      
      logger.info('Card session created', {
        sessionId,
        userId,
        cardId,
        purpose,
        ip
      });
    } catch (redisError) {
      logger.error('Failed to store card session in Redis', redisError);
      // Don't allow access if we can't store the session
      throw new Error('Failed to create secure session');
    }
    
    return { sessionId, token };
  }
  
  /**
   * Validate a card session
   */
  static async validateSession(
    sessionId: string,
    token: string,
    userId: string,
    ip: string
  ): Promise<CardSession | null> {
    try {
      const sessionData = await redis.get(`${this.SESSION_PREFIX}${sessionId}`);
      
      if (!sessionData) {
        logger.warn('Card session not found', { sessionId });
        return null;
      }
      
      const session: CardSession = JSON.parse(sessionData);
      
      // Validate token
      if (session.token !== token) {
        logger.warn('Invalid card session token', { sessionId });
        return null;
      }
      
      // Validate user ID
      if (session.userId !== userId) {
        logger.warn('Card session user mismatch', { sessionId, expected: session.userId, actual: userId });
        return null;
      }
      
      // Check expiration
      if (new Date(session.expiresAt) < new Date()) {
        logger.warn('Card session expired', { sessionId });
        await this.deleteSession(sessionId);
        return null;
      }
      
      // Optional: Validate IP address (could be strict or just log)
      if (session.ip !== ip) {
        logger.warn('Card session accessed from different IP', {
          sessionId,
          originalIp: session.ip,
          currentIp: ip
        });
        // Could reject here for strict security
      }
      
      // Delete session after use (one-time access)
      await this.deleteSession(sessionId);
      
      logger.info('Card session validated and consumed', {
        sessionId,
        purpose: session.purpose
      });
      
      return session;
    } catch (error) {
      logger.error('Failed to validate card session', error);
      return null;
    }
  }
  
  /**
   * Delete a card session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      await redis.del(`${this.SESSION_PREFIX}${sessionId}`);
    } catch (redisError) {
      logger.warn('Failed to delete card session', redisError);
    }
  }
  
  /**
   * Clean up expired sessions (for maintenance)
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const pattern = `${this.SESSION_PREFIX}*`;
      const keys = await redis.keys(pattern);
      let deletedCount = 0;
      
      for (const key of keys) {
        const sessionData = await redis.get(key);
        if (sessionData) {
          const session: CardSession = JSON.parse(sessionData);
          if (new Date(session.expiresAt) < new Date()) {
            await redis.del(key);
            deletedCount++;
          }
        }
      }
      
      logger.info(`Cleaned up ${deletedCount} expired card sessions`);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', error);
      return 0;
    }
  }
}