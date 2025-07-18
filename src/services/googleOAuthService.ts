import { OAuth2Client } from 'google-auth-library';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../config/database';
import { UserRepository } from '../repositories/userRepository';
import { TokenService } from './tokenService';
import { PasswordService } from './passwordService';
import { ValidationError, InternalError } from '../utils/errors';
import logger from '../utils/logger';
import { env } from '../config/env';

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

interface OAuthProvider {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  email: string;
  name: string;
  picture: string;
  raw_data: any;
  created_at: Date;
  updated_at: Date;
}

export class GoogleOAuthService {
  private static client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  /**
   * Generate Google OAuth URL
   */
  static generateAuthUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state || ''
    });
  }

  /**
   * Handle Google OAuth callback
   */
  static async handleCallback(code: string) {
    try {
      // Exchange code for tokens
      const { tokens } = await this.client.getToken(code);
      
      if (!tokens.access_token) {
        throw new ValidationError('Failed to get access token from Google');
      }

      // Set credentials
      this.client.setCredentials(tokens);

      // Get user info from Google
      const userInfo = await this.getUserInfo(tokens.access_token);

      // Check if user exists with this Google ID
      let oauthProvider = await this.findOAuthProvider('google', userInfo.id);
      let user;

      if (oauthProvider) {
        // User exists, update OAuth provider info
        user = await UserRepository.findById(oauthProvider.user_id);
        if (!user) {
          throw new InternalError('OAuth provider exists but user not found');
        }

        // Update OAuth provider info
        await this.updateOAuthProvider(oauthProvider.id, {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          raw_data: userInfo
        });
      } else {
        // Check if user exists with this email
        user = await UserRepository.findByEmail(userInfo.email);
        
        if (user) {
          // User exists with email, link Google account
          await this.createOAuthProvider(user.id, 'google', userInfo);
        } else {
          // Create new user
          user = await this.createUserFromGoogle(userInfo);
        }
      }

      // If Google email is verified and our email isn't, mark it as verified
      if (userInfo.verified_email && !user.email_verified) {
        await UserRepository.update(user.id, { email_verified: true });
        await UserRepository.recordAuthEvent(
          user.id,
          'email_verified',
          undefined,
          undefined,
          { method: 'google_oauth' }
        );
      }

      // Generate tokens
      const authTokens = await TokenService.generateTokenPair(user.id, user.email, user.role as any);

      // Record login event
      await UserRepository.recordAuthEvent(
        user.id,
        'login',
        undefined,
        undefined,
        { method: 'google_oauth' }
      );

      logger.info('Google OAuth login successful', { 
        userId: user.id, 
        email: user.email,
        method: 'google'
      });

      return {
        user,
        tokens: authTokens
      };
    } catch (error) {
      logger.error('Google OAuth callback error:', error);
      if (error instanceof ValidationError || error instanceof InternalError) {
        throw error;
      }
      throw new InternalError('Failed to complete Google sign-in');
    }
  }

  /**
   * Get user info from Google
   */
  private static async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info from Google');
      }

      const data = await response.json();
      return data as GoogleUserInfo;
    } catch (error) {
      logger.error('Error fetching Google user info:', error);
      throw new InternalError('Failed to fetch user information from Google');
    }
  }

  /**
   * Find OAuth provider
   */
  private static async findOAuthProvider(provider: string, providerUserId: string): Promise<OAuthProvider | null> {
    try {
      const { data, error } = await supabase
        .from('oauth_providers')
        .select('*')
        .eq('provider', provider)
        .eq('provider_user_id', providerUserId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error finding OAuth provider:', error);
      return null;
    }
  }

  /**
   * Create OAuth provider
   */
  private static async createOAuthProvider(
    userId: string, 
    provider: string, 
    userInfo: GoogleUserInfo
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('oauth_providers')
        .insert({
          id: uuidv4(),
          user_id: userId,
          provider: provider,
          provider_user_id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
          raw_data: userInfo
        });

      if (error) {
        logger.error('Error creating OAuth provider:', error);
        throw new InternalError('Failed to link Google account');
      }
    } catch (error) {
      if (error instanceof InternalError) throw error;
      logger.error('Unexpected error creating OAuth provider:', error);
      throw new InternalError('Failed to link Google account');
    }
  }

  /**
   * Update OAuth provider
   */
  private static async updateOAuthProvider(id: string, updates: Partial<OAuthProvider>): Promise<void> {
    try {
      const { error } = await supabase
        .from('oauth_providers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        logger.error('Error updating OAuth provider:', error);
      }
    } catch (error) {
      logger.error('Unexpected error updating OAuth provider:', error);
    }
  }

  /**
   * Create new user from Google data
   */
  private static async createUserFromGoogle(userInfo: GoogleUserInfo) {
    try {
      // Generate a random password for OAuth users
      const randomPassword = PasswordService.generateRandomPassword();
      const passwordHash = await PasswordService.hash(randomPassword);

      // Create user
      const userData = {
        email: userInfo.email,
        password_hash: passwordHash,
        metadata: {
          first_name: userInfo.given_name || userInfo.name.split(' ')[0] || '',
          last_name: userInfo.family_name || userInfo.name.split(' ').slice(1).join(' ') || '',
          google_id: userInfo.id,
          picture: userInfo.picture
        }
      };

      const user = await UserRepository.create(userData);

      // Mark as Google registration
      await supabase
        .from('user_profiles')
        .update({ registration_provider: 'google' })
        .eq('id', user.id);

      // Create OAuth provider record
      await this.createOAuthProvider(user.id, 'google', userInfo);

      // Tier 0 is automatically assigned by the system for new signups

      // Mark email as verified if Google says it's verified
      if (userInfo.verified_email) {
        await UserRepository.update(user.id, { email_verified: true });
      }

      // Record registration event
      await UserRepository.recordAuthEvent(
        user.id,
        'registration',
        undefined,
        undefined,
        { method: 'google_oauth' }
      );

      logger.info('New user created via Google OAuth', { 
        userId: user.id, 
        email: user.email 
      });

      return user;
    } catch (error) {
      logger.error('Error creating user from Google:', error);
      throw new InternalError('Failed to create user account');
    }
  }

  /**
   * Link Google account to existing user
   */
  static async linkGoogleAccount(userId: string, code: string): Promise<void> {
    try {
      // Exchange code for tokens
      const { tokens } = await this.client.getToken(code);
      
      if (!tokens.access_token) {
        throw new ValidationError('Failed to get access token from Google');
      }

      // Get user info from Google
      const userInfo = await this.getUserInfo(tokens.access_token);

      // Check if this Google account is already linked
      const existingProvider = await this.findOAuthProvider('google', userInfo.id);
      if (existingProvider) {
        if (existingProvider.user_id === userId) {
          throw new ValidationError('This Google account is already linked to your account');
        } else {
          throw new ValidationError('This Google account is already linked to another user');
        }
      }

      // Link the account
      await this.createOAuthProvider(userId, 'google', userInfo);

      logger.info('Google account linked successfully', { userId, googleId: userInfo.id });
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      logger.error('Error linking Google account:', error);
      throw new InternalError('Failed to link Google account');
    }
  }

  /**
   * Unlink Google account
   */
  static async unlinkGoogleAccount(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('oauth_providers')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'google');

      if (error) {
        logger.error('Error unlinking Google account:', error);
        throw new InternalError('Failed to unlink Google account');
      }

      logger.info('Google account unlinked successfully', { userId });
    } catch (error) {
      if (error instanceof InternalError) throw error;
      logger.error('Unexpected error unlinking Google account:', error);
      throw new InternalError('Failed to unlink Google account');
    }
  }

  /**
   * Get linked OAuth providers for user
   */
  static async getLinkedProviders(userId: string): Promise<Array<{ provider: string; linked: boolean }>> {
    try {
      const { data, error } = await supabase
        .from('oauth_providers')
        .select('provider')
        .eq('user_id', userId);

      if (error) {
        logger.error('Error fetching linked providers:', error);
        return [{ provider: 'google', linked: false }];
      }

      const linkedProviders = data?.map(p => p.provider) || [];
      
      return [
        { provider: 'google', linked: linkedProviders.includes('google') }
      ];
    } catch (error) {
      logger.error('Unexpected error fetching linked providers:', error);
      return [{ provider: 'google', linked: false }];
    }
  }
}