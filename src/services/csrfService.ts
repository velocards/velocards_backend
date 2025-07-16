import * as crypto from 'crypto';
import redis from '../config/redis';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

export class CSRFService {
  private static TOKEN_PREFIX = 'csrf:';
  private static TOKEN_LENGTH = 32;
  private static TOKEN_EXPIRY = 3600; // 1 hour in seconds

  /**
   * Generate a CSRF token for a session
   */
  static async generateToken(sessionId: string): Promise<string> {
    const token = crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
    
    try {
      // Store token in Redis with session association
      await redis.setex(
        `${this.TOKEN_PREFIX}${sessionId}`,
        this.TOKEN_EXPIRY,
        token
      );
      
      logger.debug(`CSRF token generated for session ${sessionId}`);
    } catch (redisError) {
      // If Redis is down, generate a signed token as fallback
      logger.warn('Redis unavailable for CSRF token storage, using signed token', redisError);
      
      // Create a signed token with timestamp
      const timestamp = Date.now();
      const data = `${sessionId}:${timestamp}`;
      const signature = crypto
        .createHmac('sha256', process.env['JWT_ACCESS_SECRET'] || '')
        .update(data)
        .digest('hex');
      
      return `${data}:${signature}`;
    }
    
    return token;
  }

  /**
   * Validate a CSRF token
   */
  static async validateToken(sessionId: string, token: string | undefined): Promise<boolean> {
    if (!token) {
      throw new ValidationError('CSRF token is required');
    }

    try {
      // Try to validate against Redis
      const storedToken = await redis.get(`${this.TOKEN_PREFIX}${sessionId}`);
      
      if (storedToken && storedToken === token) {
        // Extend token expiry on successful validation
        await redis.expire(`${this.TOKEN_PREFIX}${sessionId}`, this.TOKEN_EXPIRY);
        return true;
      }
    } catch (redisError) {
      logger.warn('Redis unavailable for CSRF validation, using signed token validation', redisError);
      
      // Fallback to signed token validation
      if (token.includes(':')) {
        const parts = token.split(':');
        if (parts.length === 3) {
          const [tokenSessionId, timestamp, signature] = parts;
          
          // Verify session ID matches
          if (tokenSessionId !== sessionId) {
            return false;
          }
          
          // Check token age (max 1 hour)
          if (!timestamp) {
            return false;
          }
          const timestampNum = parseInt(timestamp);
          if (isNaN(timestampNum)) {
            return false;
          }
          const tokenAge = Date.now() - timestampNum;
          if (tokenAge > this.TOKEN_EXPIRY * 1000) {
            return false;
          }
          
          // Verify signature
          const data = `${tokenSessionId}:${timestamp}`;
          const expectedSignature = crypto
            .createHmac('sha256', process.env['JWT_ACCESS_SECRET'] || '')
            .update(data)
            .digest('hex');
          
          return signature === expectedSignature;
        }
      }
    }

    return false;
  }

  /**
   * Double-submit cookie validation (alternative method)
   */
  static validateDoubleSubmit(headerToken: string | undefined, cookieToken: string | undefined): boolean {
    if (!headerToken || !cookieToken) {
      return false;
    }
    
    // Tokens must match and be of sufficient length
    return headerToken === cookieToken && headerToken.length >= this.TOKEN_LENGTH * 2;
  }

  /**
   * Delete CSRF token (on logout)
   */
  static async deleteToken(sessionId: string): Promise<void> {
    try {
      await redis.del(`${this.TOKEN_PREFIX}${sessionId}`);
    } catch (redisError) {
      logger.warn('Failed to delete CSRF token from Redis', redisError);
    }
  }
}