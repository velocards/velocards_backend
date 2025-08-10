import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { TwoFactorSetupResponse } from '../../types/security';

export class TwoFactorService {
  private readonly issuer = 'VeloCards';
  private readonly algorithm = 'sha1';
  private readonly digits = 6;
  private readonly period = 30;
  private readonly window = 1;
  private readonly backupCodeCount = 10;
  private readonly backupCodeLength = 8;
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env['TWO_FA_ENCRYPTION_KEY'] || process.env['JWT_SECRET'] || 'default-key';
    if (this.encryptionKey === 'default-key') {
      console.warn('Warning: Using default encryption key for 2FA. Set TWO_FA_ENCRYPTION_KEY in environment.');
    }
  }

  async generateSecret(userEmail: string): Promise<{ secret: string; otpAuthUrl: string }> {
    const secret = speakeasy.generateSecret({
      name: `${this.issuer} (${userEmail})`,
      issuer: this.issuer,
      length: 32
    });

    return {
      secret: secret.base32,
      otpAuthUrl: secret.otpauth_url || ''
    };
  }

  generateOtpAuthUrl(userEmail: string, secret: string): string {
    return speakeasy.otpauthURL({
      secret,
      label: `${this.issuer} (${userEmail})`,
      issuer: this.issuer,
      encoding: 'base32'
    });
  }

  async generateQRCode(otpAuthUrl: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Failed to generate QR code');
    }
  }

  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.backupCodeCount; i++) {
      const code = this.generateBackupCode();
      codes.push(code);
    }
    return codes;
  }

  private generateBackupCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < this.backupCodeLength; i++) {
      const randomIndex = crypto.randomInt(0, characters.length);
      code += characters[randomIndex];
    }
    return code;
  }

  verifyTOTP(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: this.window,
      algorithm: this.algorithm as any,
      digits: this.digits,
      step: this.period
    });
  }

  encryptSecret(secret: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptSecret(encryptedSecret: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const parts = encryptedSecret.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted secret format');
    }
    const [ivHex, encrypted] = parts;
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted secret format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  encryptBackupCodes(codes: string[]): string[] {
    return codes.map(code => this.encryptSecret(code));
  }

  decryptBackupCodes(encryptedCodes: string[]): string[] {
    return encryptedCodes.map(code => this.decryptSecret(code));
  }

  async setupTwoFactor(userEmail: string): Promise<TwoFactorSetupResponse> {
    const { secret, otpAuthUrl } = await this.generateSecret(userEmail);
    const qrCode = await this.generateQRCode(otpAuthUrl);
    const backupCodes = this.generateBackupCodes();

    return {
      method: 'totp' as const,
      secret,
      qrCode,
      backupCodes,
      setupToken: this.generateSetupToken()
    };
  }

  private generateSetupToken(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  verifyBackupCode(inputCode: string, storedCodes: string[]): { valid: boolean; remainingCodes?: string[] } {
    const decryptedCodes = this.decryptBackupCodes(storedCodes);
    const codeIndex = decryptedCodes.findIndex(code => code === inputCode.toUpperCase());
    
    if (codeIndex === -1) {
      return { valid: false };
    }

    // Remove used code
    const remainingDecryptedCodes = decryptedCodes.filter((_, index) => index !== codeIndex);
    const remainingEncryptedCodes = this.encryptBackupCodes(remainingDecryptedCodes);

    return {
      valid: true,
      remainingCodes: remainingEncryptedCodes
    };
  }

  generateRecoveryToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}