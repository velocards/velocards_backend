import { Request, Response } from 'express';
import { TwoFactorService } from '../../../services/security/twoFactorService';
import { TwoFactorRepository } from '../../../repositories/security/twoFactorRepository';
import { 
  twoFactorSetupSchema,
  twoFactorEnableSchema,
  twoFactorVerifySchema,
  backupCodeVerifySchema,
  twoFactorDisableSchema,
  backupCodesRegenerateSchema
} from '../../../validation/zod/auth/twoFactorSchemas';
import bcrypt from 'bcryptjs';
import { supabase } from '../../../config/database';
import { UserService } from '../../../services/userService';
import { AccountRecoveryService } from '../../../services/security/accountRecoveryService';
import { TwoFactorAuditService } from '../../../services/security/twoFactorAuditService';
import { env } from '../../../config/env';

export class TwoFactorController {
  private twoFactorService: TwoFactorService;
  private twoFactorRepository: TwoFactorRepository;
  private accountRecoveryService: AccountRecoveryService;

  constructor() {
    this.twoFactorService = new TwoFactorService();
    this.twoFactorRepository = new TwoFactorRepository();
    this.accountRecoveryService = new AccountRecoveryService();
  }

  // POST /api/v2/auth/2fa/setup - Initialize 2FA setup
  async setup(req: Request, res: Response): Promise<void> {
    try {
      const { email } = twoFactorSetupSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Check if 2FA is already enabled
      const existing2FA = await this.twoFactorRepository.getTwoFactorAuth(userId);
      if (existing2FA?.isEnabled) {
        await TwoFactorAuditService.logSetupAttempt(userId, req, false, '2FA already enabled');
        res.status(400).json({ 
          success: false, 
          error: 'Two-factor authentication is already enabled' 
        });
        return;
      }

      // Generate setup data
      const setupData = await this.twoFactorService.setupTwoFactor(email);

      // Store temporary 2FA data (not enabled yet)
      if (existing2FA) {
        await this.twoFactorRepository.updateTwoFactorAuth(userId, {
          secret: setupData.secret,
          backupCodes: this.twoFactorService.encryptBackupCodes(setupData.backupCodes),
          isEnabled: false
        });
      } else {
        await this.twoFactorRepository.createTwoFactorAuth(
          userId,
          setupData.secret,
          setupData.backupCodes
        );
      }

      // Log successful setup
      await TwoFactorAuditService.logSetupAttempt(userId, req, true);

      res.json({
        success: true,
        data: {
          qrCode: setupData.qrCode,
          backupCodes: setupData.backupCodes
        }
      });

    } catch (error: any) {
      console.error('2FA setup error:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid request data',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Setup failed. Please try again.' 
      });
    }
  }

  // POST /api/v2/auth/2fa/enable - Enable 2FA with TOTP verification
  async enable(req: Request, res: Response): Promise<void> {
    try {
      const { totpCode, password } = twoFactorEnableSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Verify password
      const { data: user } = await supabase
        .from('users')
        .select('encrypted_password')
        .eq('id', userId)
        .single();

      if (!user || !await bcrypt.compare(password, user.encrypted_password)) {
        await TwoFactorAuditService.logEnableAttempt(userId, req, false, 'Invalid password');
        res.status(400).json({ 
          success: false, 
          error: 'Invalid password' 
        });
        return;
      }

      // Get 2FA data
      const twoFAData = await this.twoFactorRepository.getTwoFactorAuth(userId);
      if (!twoFAData) {
        await TwoFactorAuditService.logEnableAttempt(userId, req, false, 'No 2FA setup found');
        res.status(400).json({ 
          success: false, 
          error: 'Please complete 2FA setup first' 
        });
        return;
      }

      if (twoFAData.isEnabled) {
        await TwoFactorAuditService.logEnableAttempt(userId, req, false, '2FA already enabled');
        res.status(400).json({ 
          success: false, 
          error: 'Two-factor authentication is already enabled' 
        });
        return;
      }

      // Verify TOTP code
      const decryptedSecret = this.twoFactorService.decryptSecret(twoFAData.secret);
      const isValidCode = this.twoFactorService.verifyTOTP(decryptedSecret, totpCode);

      if (!isValidCode) {
        await TwoFactorAuditService.logEnableAttempt(userId, req, false, 'Invalid TOTP code');
        res.status(400).json({ 
          success: false, 
          error: 'Invalid verification code' 
        });
        return;
      }

      // Enable 2FA
      await this.twoFactorRepository.enableTwoFactor(userId);

      // Log successful enablement
      await TwoFactorAuditService.logEnableAttempt(userId, req, true);

      res.json({
        success: true,
        message: 'Two-factor authentication has been enabled successfully'
      });

    } catch (error: any) {
      console.error('2FA enable error:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid request data',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Enable failed. Please try again.' 
      });
    }
  }

  // POST /api/v2/auth/2fa/verify - Verify TOTP code during login
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const { totpCode } = twoFactorVerifySchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const twoFAData = await this.twoFactorRepository.getTwoFactorAuth(userId);
      if (!twoFAData?.isEnabled) {
        res.status(400).json({ 
          success: false, 
          error: 'Two-factor authentication is not enabled' 
        });
        return;
      }

      // Verify TOTP code
      const decryptedSecret = this.twoFactorService.decryptSecret(twoFAData.secret);
      const isValidCode = this.twoFactorService.verifyTOTP(decryptedSecret, totpCode);

      if (!isValidCode) {
        await TwoFactorAuditService.logVerificationAttempt(userId, req, false, 'totp', undefined, 'Invalid TOTP code');
        
        // Check for anomalous patterns
        await TwoFactorAuditService.detectAnomalousPatterns(userId);
        
        res.status(400).json({ 
          success: false, 
          error: 'Invalid verification code' 
        });
        return;
      }

      // Update last used timestamp
      await this.twoFactorRepository.updateTwoFactorAuth(userId, {
        lastUsed: new Date()
      });

      // Log successful verification
      await TwoFactorAuditService.logVerificationAttempt(userId, req, true, 'totp');

      // Complete the login process by generating tokens
      const loginResult = await UserService.completeTwoFactorLogin(userId, req);

      // Set tokens as httpOnly cookies
      res.cookie('accessToken', loginResult.tokens.accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      });
      
      res.cookie('refreshToken', loginResult.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
      
      // Set auth mode cookie for frontend to detect secure mode
      res.cookie('auth_mode', 'secure', {
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      res.json({
        success: true,
        data: { 
          verified: true,
          user: loginResult.user,
          // Only include tokens in response if client doesn't support cookies
          ...(req.headers['x-auth-mode'] !== 'secure' && {
            accessToken: loginResult.tokens.accessToken,
            expiresIn: loginResult.tokens.expiresIn
          })
        }
      });

    } catch (error: any) {
      console.error('2FA verify error:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid request data',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Verification failed. Please try again.' 
      });
    }
  }

  // POST /api/v2/auth/2fa/backup-codes/verify - Verify backup code
  async verifyBackupCode(req: Request, res: Response): Promise<void> {
    try {
      const { backupCode } = backupCodeVerifySchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const twoFAData = await this.twoFactorRepository.getTwoFactorAuth(userId);
      if (!twoFAData?.isEnabled) {
        res.status(400).json({ 
          success: false, 
          error: 'Two-factor authentication is not enabled' 
        });
        return;
      }

      // Verify backup code
      const result = this.twoFactorService.verifyBackupCode(backupCode, twoFAData.backupCodes);
      
      if (!result.valid) {
        await TwoFactorAuditService.logVerificationAttempt(userId, req, false, 'backup_code', undefined, 'Invalid backup code');
        
        // Check for anomalous patterns
        await TwoFactorAuditService.detectAnomalousPatterns(userId);
        
        res.status(400).json({ 
          success: false, 
          error: 'Invalid backup code' 
        });
        return;
      }

      // Update remaining backup codes
      if (result.remainingCodes) {
        await this.twoFactorRepository.updateBackupCodes(userId, result.remainingCodes);
      }

      // Log successful backup code usage
      const codesRemaining = result.remainingCodes?.length || 0;
      await TwoFactorAuditService.logBackupCodeUsed(userId, req, codesRemaining);

      // Complete the login process by generating tokens
      const loginResult = await UserService.completeTwoFactorLogin(userId, req);

      // Set tokens as httpOnly cookies
      res.cookie('accessToken', loginResult.tokens.accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/'
      });
      
      res.cookie('refreshToken', loginResult.tokens.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
      
      // Set auth mode cookie for frontend to detect secure mode
      res.cookie('auth_mode', 'secure', {
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      res.json({
        success: true,
        data: { 
          verified: true,
          user: loginResult.user,
          backupCodesRemaining: result.remainingCodes?.length || 0,
          // Only include tokens in response if client doesn't support cookies
          ...(req.headers['x-auth-mode'] !== 'secure' && {
            accessToken: loginResult.tokens.accessToken,
            expiresIn: loginResult.tokens.expiresIn
          })
        }
      });

    } catch (error: any) {
      console.error('Backup code verify error:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid request data',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Verification failed. Please try again.' 
      });
    }
  }

  // POST /api/v2/auth/2fa/disable - Disable 2FA
  async disable(req: Request, res: Response): Promise<void> {
    try {
      const { password } = twoFactorDisableSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Verify password
      const { data: user } = await supabase
        .from('users')
        .select('encrypted_password')
        .eq('id', userId)
        .single();

      if (!user || !await bcrypt.compare(password, user.encrypted_password)) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid password' 
        });
        return;
      }

      // Disable 2FA
      await this.twoFactorRepository.disableTwoFactor(userId);

      res.json({
        success: true,
        message: 'Two-factor authentication has been disabled'
      });

    } catch (error: any) {
      console.error('2FA disable error:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid request data',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Disable failed. Please try again.' 
      });
    }
  }

  // GET /api/v2/auth/2fa/qrcode - Get QR code for re-display
  async getQRCode(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const twoFAData = await this.twoFactorRepository.getTwoFactorAuth(userId);
      if (!twoFAData) {
        res.status(400).json({ 
          success: false, 
          error: 'Please complete 2FA setup first' 
        });
        return;
      }

      if (twoFAData.isEnabled) {
        res.status(400).json({ 
          success: false, 
          error: 'Two-factor authentication is already enabled' 
        });
        return;
      }

      // Get user email for QR code generation
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (!user) {
        res.status(400).json({ success: false, error: 'User not found' });
        return;
      }

      const decryptedSecret = this.twoFactorService.decryptSecret(twoFAData.secret);
      const otpAuthUrl = this.twoFactorService.generateOtpAuthUrl(user.email, decryptedSecret);
      const qrCode = await this.twoFactorService.generateQRCode(otpAuthUrl);

      res.json({
        success: true,
        data: { qrCode }
      });

    } catch (error: any) {
      console.error('QR code generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate QR code' 
      });
    }
  }

  // POST /api/v2/auth/2fa/backup-codes/regenerate - Generate new backup codes
  async regenerateBackupCodes(req: Request, res: Response): Promise<void> {
    try {
      const { password } = backupCodesRegenerateSchema.parse(req.body);
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Verify password
      const { data: user } = await supabase
        .from('users')
        .select('encrypted_password')
        .eq('id', userId)
        .single();

      if (!user || !await bcrypt.compare(password, user.encrypted_password)) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid password' 
        });
        return;
      }

      const twoFAData = await this.twoFactorRepository.getTwoFactorAuth(userId);
      if (!twoFAData?.isEnabled) {
        res.status(400).json({ 
          success: false, 
          error: 'Two-factor authentication is not enabled' 
        });
        return;
      }

      // Generate new backup codes
      const newBackupCodes = this.twoFactorService.generateBackupCodes();
      const encryptedBackupCodes = this.twoFactorService.encryptBackupCodes(newBackupCodes);

      await this.twoFactorRepository.updateBackupCodes(userId, encryptedBackupCodes);

      res.json({
        success: true,
        data: { backupCodes: newBackupCodes }
      });

    } catch (error: any) {
      console.error('Backup codes regeneration error:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid request data',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        success: false, 
        error: 'Failed to regenerate backup codes' 
      });
    }
  }

  // GET /api/v2/auth/2fa/status - Get 2FA status
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const twoFAData = await this.twoFactorRepository.getTwoFactorAuth(userId);

      res.json({
        success: true,
        data: {
          isEnabled: twoFAData?.isEnabled || false,
          backupCodesRemaining: twoFAData?.backupCodes.length || 0,
          lastUsed: twoFAData?.lastUsed || null,
          setupDate: twoFAData?.createdAt || null
        }
      });

    } catch (error: any) {
      console.error('2FA status error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get status' 
      });
    }
  }

  // POST /api/v2/auth/2fa/recovery/initiate - Initiate account recovery
  async initiateRecovery(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      if (!email || typeof email !== 'string') {
        res.status(400).json({ 
          success: false, 
          error: 'Valid email is required' 
        });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');

      await this.accountRecoveryService.initiateRecovery(email, clientIp, userAgent);

      // Always return success for security (don't reveal if user exists)
      res.json({
        success: true,
        message: 'If an account with 2FA enabled exists for this email, recovery instructions have been sent.'
      });

    } catch (error: any) {
      console.error('Recovery initiation error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Recovery initiation failed' 
      });
    }
  }

  // POST /api/v2/auth/2fa/recovery/verify - Verify recovery token
  async verifyRecovery(req: Request, res: Response): Promise<void> {
    try {
      const { recoveryToken, newPassword } = req.body;
      
      if (!recoveryToken || typeof recoveryToken !== 'string') {
        res.status(400).json({ 
          success: false, 
          error: 'Recovery token is required' 
        });
        return;
      }

      const result = await this.accountRecoveryService.verifyRecoveryToken(recoveryToken, newPassword);
      
      if (!result.valid) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid or expired recovery token' 
        });
        return;
      }

      res.json({
        success: true,
        data: {
          backupCodes: result.backupCodes,
          message: 'Account recovery completed. New backup codes have been generated.'
        }
      });

    } catch (error: any) {
      console.error('Recovery verification error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Recovery verification failed' 
      });
    }
  }

  // POST /api/v2/auth/2fa/recovery/disable - Disable 2FA via recovery
  async disableViaRecovery(req: Request, res: Response): Promise<void> {
    try {
      const { recoveryToken } = req.body;
      
      if (!recoveryToken || typeof recoveryToken !== 'string') {
        res.status(400).json({ 
          success: false, 
          error: 'Recovery token is required' 
        });
        return;
      }

      const result = await this.accountRecoveryService.verifyRecoveryToken(recoveryToken);
      
      if (!result.valid || !result.userId) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid or expired recovery token' 
        });
        return;
      }

      const success = await this.accountRecoveryService.disableTwoFactorViaRecovery(result.userId);
      
      if (!success) {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to disable two-factor authentication' 
        });
        return;
      }

      res.json({
        success: true,
        message: 'Two-factor authentication has been disabled for your account.'
      });

    } catch (error: any) {
      console.error('Recovery disable error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to disable 2FA via recovery' 
      });
    }
  }
}