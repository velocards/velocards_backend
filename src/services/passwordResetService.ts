import { randomBytes } from 'crypto';
import { supabase } from '../config/database';
import { PasswordService } from './passwordService';
import { EmailService } from './emailService';
import { UserRepository } from '../repositories/userRepository';
import { AppError, ValidationError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
import { env } from '../config/env';

export class PasswordResetService {
  private static readonly TOKEN_LENGTH = 32;
  private static readonly TOKEN_EXPIRY_HOURS = 1;
  private static readonly MAX_ACTIVE_TOKENS = 3;

  /**
   * Generate a secure random token
   */
  private static generateToken(): string {
    return randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Check if user has too many active reset tokens
   */
  private static async checkActiveTokens(userId: string): Promise<void> {
    const { data: activeTokens, error } = await supabase
      .from('password_reset_tokens')
      .select('id')
      .eq('user_id', userId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      logger.error('Error checking active tokens', error);
      throw new AppError('DATABASE_ERROR', 'Failed to check active tokens', 500);
    }

    if (activeTokens && activeTokens.length >= this.MAX_ACTIVE_TOKENS) {
      throw new ValidationError('Too many active password reset requests. Please wait before requesting another.');
    }
  }

  /**
   * Invalidate all previous tokens for a user
   */
  private static async invalidatePreviousTokens(userId: string): Promise<void> {
    const { error } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('used_at', null);

    if (error) {
      logger.error('Error invalidating previous tokens', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Request a password reset
   */
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      // Find user by email
      const user = await UserRepository.findByEmail(email);
      
      // Don't reveal if email exists or not for security
      if (!user) {
        logger.info('Password reset requested for non-existent email', { email });
        return; // Silent fail
      }

      // Check if user has too many active tokens
      await this.checkActiveTokens(user.id);

      // Invalidate previous tokens
      await this.invalidatePreviousTokens(user.id);

      // Generate new token
      const token = this.generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

      // Save token to database
      const { error } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          token,
          expires_at: expiresAt.toISOString()
        });

      if (error) {
        logger.error('Error saving password reset token', error);
        throw new AppError('DATABASE_ERROR', 'Failed to create password reset token', 500);
      }

      // Send email
      await this.sendPasswordResetEmail(user.email, token);

      logger.info('Password reset email sent', { 
        userId: user.id, 
        email: user.email 
      });
    } catch (error) {
      if (error instanceof AppError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Unexpected error in password reset request', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to process password reset request', 500);
    }
  }

  /**
   * Send password reset email
   */
  private static async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const template = {
      subject: 'Reset Your VeloCards Password',
      htmlContent: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f9f9f9;
                }
                .email-container {
                    background: white;
                    border-radius: 8px;
                    padding: 30px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #2563eb;
                }
                .company-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2563eb;
                    margin-bottom: 5px;
                }
                .content {
                    margin: 20px 0;
                }
                .button {
                    display: inline-block;
                    background: #2563eb;
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: bold;
                    margin: 20px 0;
                }
                .warning {
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }
                .footer {
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    font-size: 14px;
                    color: #6b7280;
                    text-align: center;
                }
                .security-info {
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 6px;
                    margin: 20px 0;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <div class="company-name">VeloCards</div>
                    <div style="font-size: 20px; color: #333;">Password Reset Request</div>
                </div>
                
                <div class="content">
                    <p>Hello,</p>
                    
                    <p>We received a request to reset the password for your VeloCards account associated with this email address.</p>
                    
                    <p>To reset your password, please click the button below:</p>
                    
                    <div style="text-align: center;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Important:</strong>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>This link will expire in ${this.TOKEN_EXPIRY_HOURS} hour(s)</li>
                            <li>For security reasons, this link can only be used once</li>
                            <li>If you didn't request this reset, please ignore this email</li>
                        </ul>
                    </div>
                    
                    <div class="security-info">
                        <strong>Security Tips:</strong>
                        <ul style="margin: 10px 0; padding-left: 20px;">
                            <li>Never share your password with anyone</li>
                            <li>Use a strong, unique password for your account</li>
                            <li>Enable two-factor authentication for added security</li>
                        </ul>
                    </div>
                    
                    <p>If you're having trouble with the button above, copy and paste the following link into your browser:</p>
                    <p style="word-break: break-all; font-size: 12px; color: #6b7280;">${resetUrl}</p>
                </div>
                
                <div class="footer">
                    <p><strong>VeloCards</strong></p>
                    <p>Email: support@velocards.com</p>
                    <p style="margin-top: 10px; font-size: 12px;">
                        This is an automated security email. Please do not reply to this message.
                    </p>
                </div>
            </div>
        </body>
        </html>
      `,
      textContent: `
VeloCards - Password Reset Request

Hello,

We received a request to reset the password for your VeloCards account associated with this email address.

To reset your password, please visit the following link:
${resetUrl}

IMPORTANT:
- This link will expire in ${this.TOKEN_EXPIRY_HOURS} hour(s)
- For security reasons, this link can only be used once
- If you didn't request this reset, please ignore this email

Security Tips:
- Never share your password with anyone
- Use a strong, unique password for your account
- Enable two-factor authentication for added security

If you're having trouble accessing the link, copy and paste it into your browser.

VeloCards
Email: support@velocards.com

This is an automated security email. Please do not reply to this message.
      `
    };

    // Check if email service is ready
    if (!EmailService.isReady()) {
      logger.warn('Email service not configured, logging reset URL to console', {
        email,
        resetUrl
      });
      return;
    }

    // Send email
    await EmailService.sendEmail({
      to: email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  /**
   * Validate password reset token
   */
  static async validateToken(token: string): Promise<{ userId: string; email: string }> {
    try {
      // Find token
      const { data: resetToken, error } = await supabase
        .from('password_reset_tokens')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !resetToken) {
        throw new ValidationError('Invalid or expired password reset token');
      }

      // Get user
      const user = await UserRepository.findById(resetToken.user_id);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return {
        userId: user.id,
        email: user.email
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error validating reset token', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to validate token', 500);
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      // Validate token and get user
      const { userId } = await this.validateToken(token);

      // Validate new password
      PasswordService.validatePassword(newPassword);

      // Hash new password
      const passwordHash = await PasswordService.hash(newPassword);

      // Start transaction
      const now = new Date().toISOString();

      // Update password in user_auth table
      const { error: authError } = await supabase
        .from('user_auth')
        .update({
          password_hash: passwordHash,
          password_changed_at: now,
          failed_login_attempts: 0,
          locked_until: null,
          updated_at: now
        })
        .eq('user_id', userId);

      if (authError) {
        logger.error('Error updating password', authError);
        throw new AppError('DATABASE_ERROR', 'Failed to update password', 500);
      }

      // Mark token as used
      const { error: tokenError } = await supabase
        .from('password_reset_tokens')
        .update({ used_at: now })
        .eq('token', token);

      if (tokenError) {
        logger.error('Error marking token as used', tokenError);
        // Don't throw - password was already updated
      }

      // Log password change event
      await supabase
        .from('auth_events')
        .insert({
          user_id: userId,
          event_type: 'password_reset',
          metadata: { reset_method: 'email_token' }
        });

      logger.info('Password reset successful', { userId });
    } catch (error) {
      if (error instanceof AppError || error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Unexpected error in password reset', error);
      throw new AppError('INTERNAL_ERROR', 'Failed to reset password', 500);
    }
  }

  /**
   * Clean up expired tokens (for maintenance)
   */
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      const { error } = await supabase
        .from('password_reset_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        logger.error('Error cleaning up expired tokens', error);
      } else {
        logger.info('Expired password reset tokens cleaned up');
      }
    } catch (error) {
      logger.error('Error in token cleanup', error);
    }
  }
}