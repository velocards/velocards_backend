import { supabase } from '../../config/database';
import { TwoFactorAuthData, UserSession, SessionCreateData } from '../../types/security';
import { TwoFactorService } from '../../services/security/twoFactorService';
import { SessionManager } from '../../services/security/sessionManager';

export class TwoFactorRepository {
  private twoFactorService: TwoFactorService;
  private sessionManager: SessionManager;

  constructor() {
    this.twoFactorService = new TwoFactorService();
    this.sessionManager = new SessionManager();
  }

  async createTwoFactorAuth(userId: string, secret: string, backupCodes: string[]): Promise<TwoFactorAuthData | null> {
    try {
      const encryptedSecret = this.twoFactorService.encryptSecret(secret);
      const encryptedBackupCodes = this.twoFactorService.encryptBackupCodes(backupCodes);

      const { data, error } = await supabase
        .from('two_factor_auth')
        .insert({
          user_id: userId,
          secret: encryptedSecret,
          backup_codes: encryptedBackupCodes,
          is_enabled: false
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapToTwoFactorAuthData(data);
    } catch (error) {
      console.error('Error creating 2FA auth:', error);
      return null;
    }
  }

  async getTwoFactorAuth(userId: string): Promise<TwoFactorAuthData | null> {
    try {
      const { data, error } = await supabase
        .from('two_factor_auth')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? this.mapToTwoFactorAuthData(data) : null;
    } catch (error) {
      console.error('Error getting 2FA auth:', error);
      return null;
    }
  }

  async updateTwoFactorAuth(userId: string, updates: Partial<TwoFactorAuthData>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (updates.isEnabled !== undefined) {
        updateData.is_enabled = updates.isEnabled;
      }
      
      if (updates.lastUsed !== undefined) {
        updateData.last_used = updates.lastUsed;
      }
      
      if (updates.backupCodes !== undefined) {
        updateData.backup_codes = updates.backupCodes;
      }

      if (updates.secret !== undefined) {
        updateData.secret = this.twoFactorService.encryptSecret(updates.secret);
      }

      if (updates.setupInitiatedAt !== undefined) {
        updateData.setup_initiated_at = updates.setupInitiatedAt;
      }

      const { error } = await supabase
        .from('two_factor_auth')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating 2FA auth:', error);
      return false;
    }
  }

  async enableTwoFactor(userId: string): Promise<boolean> {
    return this.updateTwoFactorAuth(userId, { isEnabled: true });
  }

  async disableTwoFactor(userId: string): Promise<boolean> {
    return this.updateTwoFactorAuth(userId, { isEnabled: false });
  }

  async updateBackupCodes(userId: string, remainingCodes: string[]): Promise<boolean> {
    return this.updateTwoFactorAuth(userId, { backupCodes: remainingCodes });
  }

  async deleteTwoFactorAuth(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('two_factor_auth')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting 2FA auth:', error);
      return false;
    }
  }

  async createSession(sessionData: SessionCreateData): Promise<UserSession | null> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert({
          user_id: sessionData.userId,
          refresh_token_hash: this.sessionManager.hashRefreshToken(sessionData.refreshToken),
          device_fingerprint: sessionData.deviceFingerprint || null,
          ip_address: sessionData.ipAddress || null,
          user_agent: sessionData.userAgent || null,
          two_fa_verified: sessionData.twoFaVerified || false,
          expires_at: this.sessionManager.calculateSessionExpiry()
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapToUserSession(data);
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? this.mapToUserSession(data) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<UserSession | null> {
    try {
      const tokenHash = this.sessionManager.hashRefreshToken(refreshToken);
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('refresh_token_hash', tokenHash)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? this.mapToUserSession(data) : null;
    } catch (error) {
      console.error('Error getting session by refresh token:', error);
      return null;
    }
  }

  async getUserSessions(userId: string, activeOnly: boolean = true): Promise<UserSession[]> {
    try {
      let query = supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data ? data.map(this.mapToUserSession) : [];
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  async updateSession(sessionId: string, updates: Partial<UserSession>): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (updates.lastActivity !== undefined) {
        updateData.last_activity = updates.lastActivity;
      }
      
      if (updates.twoFaVerified !== undefined) {
        updateData.two_fa_verified = updates.twoFaVerified;
      }
      
      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      const { error } = await supabase
        .from('user_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }

  async revokeSession(sessionId: string): Promise<boolean> {
    return this.updateSession(sessionId, { isActive: false });
  }

  async revokeSessions(sessionIds: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .in('id', sessionIds);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error revoking sessions:', error);
      return false;
    }
  }

  async revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<boolean> {
    try {
      let query = supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (exceptSessionId) {
        query = query.neq('id', exceptSessionId);
      }

      const { error } = await query;

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error revoking all user sessions:', error);
      return false;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .lt('expires_at', new Date().toISOString())
        .eq('is_active', true)
        .select();

      if (error) throw error;
      return data ? data.length : 0;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }

  private mapToTwoFactorAuthData(data: any): TwoFactorAuthData {
    return {
      id: data.id,
      userId: data.user_id,
      secret: data.secret,
      backupCodes: data.backup_codes,
      isEnabled: data.is_enabled,
      lastUsed: data.last_used ? new Date(data.last_used) : null,
      setupInitiatedAt: data.setup_initiated_at ? new Date(data.setup_initiated_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapToUserSession(data: any): UserSession {
    return {
      id: data.id,
      userId: data.user_id,
      refreshTokenHash: data.refresh_token_hash,
      deviceFingerprint: data.device_fingerprint,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      isActive: data.is_active,
      twoFaVerified: data.two_fa_verified,
      lastActivity: new Date(data.last_activity),
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at)
    };
  }
}