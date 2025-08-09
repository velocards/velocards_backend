import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { UserSession, SessionCreateData } from '../../types/security';

export class SessionManager {
  private readonly sessionDurationMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxConcurrentSessions = 5;
  private readonly activityTimeoutMs = 30 * 60 * 1000; // 30 minutes

  generateSessionId(): string {
    return uuidv4();
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  createDeviceFingerprint(userAgent: string | undefined, screenResolution?: string): string {
    const data = `${userAgent || 'unknown'}:${screenResolution || 'unknown'}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  calculateSessionExpiry(): Date {
    return new Date(Date.now() + this.sessionDurationMs);
  }

  isSessionExpired(session: UserSession): boolean {
    return new Date() > new Date(session.expiresAt);
  }

  isSessionInactive(session: UserSession): boolean {
    const inactiveTime = Date.now() - new Date(session.lastActivity).getTime();
    return inactiveTime > this.activityTimeoutMs;
  }

  shouldRevokeSession(session: UserSession): boolean {
    return !session.isActive || 
           this.isSessionExpired(session) || 
           this.isSessionInactive(session);
  }

  async validateSessionLimit(userSessions: UserSession[]): Promise<string[]> {
    const activeSessions = userSessions
      .filter(s => s.isActive && !this.shouldRevokeSession(s))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (activeSessions.length >= this.maxConcurrentSessions) {
      // Return IDs of sessions to revoke (oldest sessions)
      return activeSessions
        .slice(this.maxConcurrentSessions - 1)
        .map(s => s.id);
    }

    return [];
  }

  detectAnomalousActivity(
    currentSession: SessionCreateData,
    previousSessions: UserSession[]
  ): boolean {
    if (previousSessions.length === 0) return false;

    // Check for rapid location changes (different IP ranges)
    if (currentSession.ipAddress) {
      const recentSessions = previousSessions
        .filter(s => {
          const timeDiff = Date.now() - new Date(s.createdAt).getTime();
          return timeDiff < 60 * 60 * 1000; // Last hour
        });

      for (const session of recentSessions) {
        if (session.ipAddress && 
            this.isDifferentIpRange(currentSession.ipAddress, session.ipAddress)) {
          return true; // Suspicious: Different IP range within short time
        }
      }
    }

    // Check for unusual device fingerprint patterns
    if (currentSession.deviceFingerprint) {
      const uniqueFingerprints = new Set(
        previousSessions
          .filter(s => s.deviceFingerprint)
          .map(s => s.deviceFingerprint)
      );

      // If there are many different devices in a short period
      if (uniqueFingerprints.size > 10) {
        return true;
      }
    }

    return false;
  }

  private isDifferentIpRange(ip1: string, ip2: string): boolean {
    // Handle IPv4 addresses
    if (ip1.includes('.') && ip2.includes('.')) {
      const parts1 = ip1.split('.').slice(0, 2);
      const parts2 = ip2.split('.').slice(0, 2);
      return parts1.join('.') !== parts2.join('.');
    }
    
    // Handle IPv6 addresses (simplified check)
    if (ip1.includes(':') && ip2.includes(':')) {
      const parts1 = ip1.split(':').slice(0, 3);
      const parts2 = ip2.split(':').slice(0, 3);
      return parts1.join(':') !== parts2.join(':');
    }
    
    // Different IP versions
    return true;
  }

  formatSessionInfo(session: UserSession): object {
    return {
      id: session.id,
      deviceInfo: this.parseUserAgent(session.userAgent),
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      twoFaVerified: session.twoFaVerified,
      createdAt: session.createdAt
    };
  }

  private parseUserAgent(userAgent: string | null): object {
    if (!userAgent) {
      return { browser: 'Unknown', os: 'Unknown' };
    }

    // Simple user agent parsing (in production, use a library like ua-parser-js)
    const browser = userAgent.includes('Chrome') ? 'Chrome' :
                   userAgent.includes('Firefox') ? 'Firefox' :
                   userAgent.includes('Safari') ? 'Safari' :
                   userAgent.includes('Edge') ? 'Edge' : 'Other';

    const os = userAgent.includes('Windows') ? 'Windows' :
               userAgent.includes('Mac') ? 'macOS' :
               userAgent.includes('Linux') ? 'Linux' :
               userAgent.includes('Android') ? 'Android' :
               userAgent.includes('iOS') ? 'iOS' : 'Other';

    return { browser, os };
  }
}