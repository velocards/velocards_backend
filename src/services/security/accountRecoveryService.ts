import * as crypto from 'crypto';
import { TwoFactorRepository } from '../../repositories/security/twoFactorRepository';
import { TwoFactorService } from './twoFactorService';
import { UserRepository } from '../../repositories/userRepository';
import { EmailService } from '../emailService';
import { supabase } from '../../config/database';

export class AccountRecoveryService {
  private twoFactorRepository: TwoFactorRepository;
  private twoFactorService: TwoFactorService;
  private readonly recoveryTokenExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.twoFactorRepository = new TwoFactorRepository();
    this.twoFactorService = new TwoFactorService();
  }

  async initiateRecovery(email: string, ipAddress?: string, userAgent?: string): Promise<boolean> {
    try {
      // Find user by email
      const user = await UserRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        return true;
      }

      // Check if user has 2FA enabled
      const twoFAData = await this.twoFactorRepository.getTwoFactorAuth(user.id);
      if (!twoFAData?.isEnabled) {
        // User doesn't have 2FA enabled, no recovery needed
        return true;
      }

      // Generate recovery token
      const recoveryToken = this.twoFactorService.generateRecoveryToken();
      const tokenHash = this.twoFactorService.hashToken(recoveryToken);
      const expiresAt = new Date(Date.now() + this.recoveryTokenExpiry);

      // Store recovery token in database
      await this.storeRecoveryToken(user.id, tokenHash, expiresAt, ipAddress, userAgent);

      // Send recovery email
      await this.sendRecoveryEmail(user.email, (user as any).firstName || 'User', recoveryToken);

      return true;
    } catch (error) {
      console.error('Account recovery initiation failed:', error);
      return false;
    }
  }

  async verifyRecoveryToken(token: string, newPassword?: string): Promise<{ valid: boolean; userId?: string; backupCodes?: string[] }> {
    try {
      const tokenHash = this.twoFactorService.hashToken(token);

      // Find recovery request
      const { data: recovery, error } = await supabase
        .from('account_recovery_requests')
        .select('*')
        .eq('token_hash', tokenHash)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !recovery) {
        return { valid: false };
      }

      // Mark token as used
      await supabase
        .from('account_recovery_requests')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', recovery.id);

      // Generate new backup codes
      const newBackupCodes = this.twoFactorService.generateBackupCodes();
      await this.twoFactorRepository.updateBackupCodes(
        recovery.user_id, 
        this.twoFactorService.encryptBackupCodes(newBackupCodes)
      );

      // If new password provided, update it
      if (newPassword) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        
        await supabase
          .from('users')
          .update({ encrypted_password: hashedPassword })
          .eq('id', recovery.user_id);
      }

      return {
        valid: true,
        userId: recovery.user_id,
        backupCodes: newBackupCodes
      };
    } catch (error) {
      console.error('Recovery token verification failed:', error);
      return { valid: false };
    }
  }

  async disableTwoFactorViaRecovery(userId: string): Promise<boolean> {
    try {
      // Disable 2FA for the user
      await this.twoFactorRepository.disableTwoFactor(userId);
      
      // Delete 2FA data (optional - for complete reset)
      await this.twoFactorRepository.deleteTwoFactorAuth(userId);

      return true;
    } catch (error) {
      console.error('Failed to disable 2FA via recovery:', error);
      return false;
    }
  }

  private async storeRecoveryToken(
    userId: string, 
    tokenHash: string, 
    expiresAt: Date, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    await supabase
      .from('account_recovery_requests')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString()
      });
  }

  private async sendRecoveryEmail(email: string, firstName: string, recoveryToken: string): Promise<void> {
    const recoveryUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:3000'}/auth/recovery?token=${recoveryToken}`;
    
    const emailHtml = `
      <h2>Account Recovery Request</h2>
      <p>Hello ${firstName},</p>
      <p>We received a request to recover your account that has Two-Factor Authentication enabled.</p>
      <p>If you made this request, click the link below to proceed with account recovery:</p>
      <p><a href="${recoveryUrl}">Recover My Account</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't request this recovery, please ignore this email and contact support if you have concerns.</p>
      <p>For security reasons, this recovery process will generate new backup codes for your account.</p>
      <br>
      <p>Best regards,<br>VeloCards Security Team</p>
    `;

    await EmailService.sendEmail({
      to: email,
      subject: 'Account Recovery - Two-Factor Authentication Reset',
      html: emailHtml,
      text: `Account Recovery for ${firstName}\n\nPlease visit: ${recoveryUrl}\n\nThis link expires in 1 hour.`
    });
  }

  async cleanupExpiredTokens(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('account_recovery_requests')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select();

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Failed to cleanup expired recovery tokens:', error);
      return 0;
    }
  }
}