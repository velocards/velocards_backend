import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../config/database';
import { UserRepository } from '../repositories/userRepository';
import { EmailService } from './emailService';
import { NotFoundError, ValidationError, InternalError } from '../utils/errors';
import logger from '../utils/logger';
import { env } from '../config/env';

export class EmailVerificationService {
  private static readonly TOKEN_EXPIRY_HOURS = 24; // Email verification tokens valid for 24 hours
  
  /**
   * Generate and send verification email
   */
  static async sendVerificationEmail(userId: string): Promise<void> {
    try {
      // Get user details
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.email_verified) {
        throw new ValidationError('Email already verified');
      }

      // Check if there's an existing valid token
      const existingToken = await this.getValidTokenForUser(userId);
      if (existingToken) {
        // Token already exists and is still valid
        logger.info('Existing verification token found, resending email');
        // Since we can't get the original token, we'll delete the old one and create a new one
        await this.deleteExistingTokens(userId);
      }

      // Generate new token
      const token = this.generateToken();
      const tokenHash = this.hashToken(token);
      
      // Store token in database
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);
      
      const { error } = await supabase
        .from('email_verification_tokens')
        .insert({
          id: uuidv4(),
          user_id: userId,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        logger.error('Error storing verification token:', error);
        throw new InternalError('Failed to create verification token');
      }

      // Send verification email
      await this.sendEmail(user.email, user.metadata.first_name || 'User', token);
      
      logger.info('Verification email sent successfully', { userId, email: user.email });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error sending verification email:', error);
      throw new InternalError('Failed to send verification email');
    }
  }

  /**
   * Verify email with token
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const tokenHash = this.hashToken(token);
      
      // Find the token
      const { data: tokenData, error } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .is('verified_at', null)
        .single();

      if (error || !tokenData) {
        throw new ValidationError('Invalid or expired verification token');
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        throw new ValidationError('Verification token has expired');
      }

      // Mark token as used
      const { error: updateError } = await supabase
        .from('email_verification_tokens')
        .update({ verified_at: new Date().toISOString() })
        .eq('id', tokenData.id);

      if (updateError) {
        logger.error('Error updating token:', updateError);
        throw new InternalError('Failed to update verification token');
      }

      // Update user's email_verified status
      await UserRepository.update(tokenData.user_id, { email_verified: true });

      // Record auth event
      await UserRepository.recordAuthEvent(
        tokenData.user_id,
        'email_verified',
        undefined,
        undefined,
        { method: 'email_token' }
      );

      logger.info('Email verified successfully', { userId: tokenData.user_id });
      
      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error verifying email:', error);
      throw new InternalError('Failed to verify email');
    }
  }

  /**
   * Check if a verification token is valid
   */
  static async validateToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const tokenHash = this.hashToken(token);
      
      const { data: tokenData, error } = await supabase
        .from('email_verification_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .is('verified_at', null)
        .single();

      if (error || !tokenData) {
        return { valid: false };
      }

      // Check if expired
      if (new Date(tokenData.expires_at) < new Date()) {
        return { valid: false };
      }

      return { valid: true, userId: tokenData.user_id };
    } catch (error) {
      logger.error('Error validating token:', error);
      return { valid: false };
    }
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail(email: string): Promise<void> {
    try {
      const user = await UserRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        logger.info('Resend verification requested for non-existent email:', email);
        return;
      }

      if (user.email_verified) {
        throw new ValidationError('Email already verified');
      }

      await this.sendVerificationEmail(user.id);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error resending verification email:', error);
      throw new InternalError('Failed to resend verification email');
    }
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('email_verification_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .is('verified_at', null)
        .select('id');

      if (error) {
        logger.error('Error cleaning up expired tokens:', error);
        return 0;
      }

      const deletedCount = data?.length || 0;
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired email verification tokens`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Unexpected error cleaning up tokens:', error);
      return 0;
    }
  }

  /**
   * Get valid token for user if exists
   */
  private static async getValidTokenForUser(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('email_verification_tokens')
        .select('id')
        .eq('user_id', userId)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete existing tokens for a user
   */
  private static async deleteExistingTokens(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('email_verification_tokens')
        .delete()
        .eq('user_id', userId)
        .is('verified_at', null);

      if (error) {
        logger.error('Error deleting existing tokens:', error);
      }
    } catch (error) {
      logger.error('Unexpected error deleting tokens:', error);
    }
  }

  /**
   * Send verification email
   */
  private static async sendEmail(email: string, firstName: string, token: string): Promise<void> {
    const verificationLink = `${env.FRONTEND_URL}/auth/verify-email?token=${token}`;
    
    const emailData = {
      to: email,
      subject: 'Verify Your VeloCards Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to VeloCards, ${firstName}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for signing up. Please verify your email address to complete your registration.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #666; line-height: 1.6;">
            Or copy and paste this link in your browser:
          </p>
          <p style="color: #4F46E5; word-break: break-all;">
            ${verificationLink}
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 14px;">
            This link will expire in ${this.TOKEN_EXPIRY_HOURS} hours. If you didn't create an account, 
            you can safely ignore this email.
          </p>
        </div>
      `,
      text: `
        Welcome to VeloCards, ${firstName}!
        
        Please verify your email address by clicking the link below:
        ${verificationLink}
        
        This link will expire in ${this.TOKEN_EXPIRY_HOURS} hours.
        
        If you didn't create an account, you can safely ignore this email.
      `
    };

    await EmailService.sendEmail(emailData);
  }

  /**
   * Generate a secure random token
   */
  private static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash token for storage
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}