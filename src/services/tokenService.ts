import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { jwt as jwtConfig } from '../config/env';
import redis from '../config/redis';
import { AuthenticationError } from '../utils/errors';
import { UserRole, Permission, getRolePermissions } from '../config/roles';

interface TokenPayload {
  sub: string; // user id
  email: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

interface AccessTokenPayload extends TokenPayload {
  type: 'access';
  role?: UserRole;
  permissions?: Permission[];
}

interface RefreshTokenPayload extends TokenPayload {
  type: 'refresh';
}

export class TokenService {
  private static REFRESH_TOKEN_PREFIX = 'refresh_token:';
  private static SESSION_PREFIX = 'session:';

  static async generateTokenPair(userId: string, email: string, role?: UserRole) {
    const sessionId = uuidv4();

    // Get permissions for the role
    const permissions = role ? getRolePermissions(role) : [];

    // Generate access token with role and permissions
    const accessToken = jwt.sign(
      {
        sub: userId,
        email,
        sessionId,
        type: 'access',
        role,
        permissions
      } as AccessTokenPayload,
      jwtConfig.accessSecret,
      {
        expiresIn: jwtConfig.accessExpiry,
        issuer: 'digistreets',
        algorithm: 'HS256'
      } as jwt.SignOptions
    );

    // Generate refresh token (doesn't need role/permissions)
    const refreshToken = jwt.sign(
      {
        sub: userId,
        email,
        sessionId,
        type: 'refresh'
      } as RefreshTokenPayload,
      jwtConfig.refreshSecret,
      {
        expiresIn: jwtConfig.refreshExpiry,
        issuer: 'digistreets',
        algorithm: 'HS256'
      } as jwt.SignOptions
    );

    // Try to store session in Redis, but don't fail if Redis is down
    try {
      await redis.setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        7 * 24 * 60 * 60, // 7 days
        JSON.stringify({
          userId,
          email,
          createdAt: new Date().toISOString()
        })
      );

      // Store refresh token in Redis for revocation checking
      await redis.setex(
        `${this.REFRESH_TOKEN_PREFIX}${sessionId}`,
        7 * 24 * 60 * 60, // 7 days
        refreshToken
      );
    } catch (redisError) {
      // Log the error but don't fail the registration
      console.warn('Redis storage failed during token generation, continuing without session persistence:', redisError);
      // In production, you might want to alert monitoring systems here
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  static async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = jwt.verify(token, jwtConfig.accessSecret, {
        algorithms: ['HS256'],
        issuer: 'digistreets'
      }) as AccessTokenPayload;

      // Check if session exists (only if Redis is available)
      try {
        const sessionExists = await redis.exists(`${this.SESSION_PREFIX}${payload.sessionId}`);
        if (!sessionExists) {
          throw new AuthenticationError('Session expired');
        }
      } catch (redisError) {
        // If Redis is down, we'll allow the token through (degraded mode)
        console.warn('Redis unavailable during session check, allowing token:', redisError);
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired');
      }
      throw new AuthenticationError('Invalid token');
    }
  }

  static async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = jwt.verify(token, jwtConfig.refreshSecret, {
        algorithms: ['HS256'],
        issuer: 'digistreets'
      }) as RefreshTokenPayload;

      // Check if refresh token exists in Redis (if Redis is available)
      try {
        const storedToken = await redis.get(`${this.REFRESH_TOKEN_PREFIX}${payload.sessionId}`);
        if (!storedToken || storedToken !== token) {
          throw new AuthenticationError('Invalid refresh token');
        }
      } catch (redisError) {
        // If Redis is down, we'll still allow the refresh if the JWT is valid
        console.warn('Redis unavailable during refresh token check, allowing token:', redisError);
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Refresh token expired');
      }
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  static async refreshTokens(refreshToken: string, userRole?: UserRole) {
    const payload = await this.verifyRefreshToken(refreshToken);

    // Try to delete old refresh token (don't fail if Redis is down)
    try {
      await redis.del(`${this.REFRESH_TOKEN_PREFIX}${payload.sessionId}`);
    } catch (redisError) {
      console.warn('Redis unavailable during token deletion:', redisError);
    }

    // Generate new token pair with role
    return this.generateTokenPair(payload.sub, payload.email, userRole);
  }

  static async revokeSession(sessionId: string) {
    try {
      await redis.del([
        `${this.SESSION_PREFIX}${sessionId}`,
        `${this.REFRESH_TOKEN_PREFIX}${sessionId}`
      ]);
    } catch (redisError) {
      console.warn('Redis unavailable during session revocation:', redisError);
      // Don't throw - logout should still succeed even if Redis is down
    }
  }

  static async revokeAllUserSessions(userId: string) {
    // Get all sessions for user
    const keys = await redis.keys(`${this.SESSION_PREFIX}*`);

    for (const key of keys) {
      const session = await redis.get(key);
      if (session) {
        const sessionData = JSON.parse(session);
        if (sessionData.userId === userId) {
          const sessionId = key.replace(this.SESSION_PREFIX, '');
          await this.revokeSession(sessionId);
        }
      }
    }
  }
}