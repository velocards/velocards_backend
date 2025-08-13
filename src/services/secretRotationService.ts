import { configValidationService } from './configValidationService';
import logger from '../utils/logger';
import * as crypto from 'crypto';

/**
 * Secret Rotation Service
 * Manages automatic and manual rotation of sensitive configuration values
 */

interface SecretRotationConfig {
  name: string;
  type: 'jwt' | 'api_key' | 'encryption_key' | 'oauth_secret';
  rotationIntervalDays: number;
  lastRotated?: Date;
  nextRotation?: Date;
}

interface RotationResult {
  success: boolean;
  secretName: string;
  newValue?: string;
  error?: string;
}

class SecretRotationService {
  private rotationConfigs: Map<string, SecretRotationConfig> = new Map();
  private rotationSchedule: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeRotationConfigs();
  }

  /**
   * Initialize rotation configurations for all secrets
   */
  private initializeRotationConfigs(): void {
    // JWT Secrets - rotate quarterly
    this.addRotationConfig({
      name: 'JWT_ACCESS_SECRET',
      type: 'jwt',
      rotationIntervalDays: 90,
    });
    
    this.addRotationConfig({
      name: 'JWT_REFRESH_SECRET',
      type: 'jwt',
      rotationIntervalDays: 90,
    });

    // Encryption Keys - rotate bi-annually
    this.addRotationConfig({
      name: 'ENCRYPTION_KEY',
      type: 'encryption_key',
      rotationIntervalDays: 180,
    });
    
    this.addRotationConfig({
      name: 'TWO_FA_ENCRYPTION_KEY',
      type: 'encryption_key',
      rotationIntervalDays: 180,
    });

    // API Keys - rotate annually
    this.addRotationConfig({
      name: 'ADMEDIACARDS_API_KEY',
      type: 'api_key',
      rotationIntervalDays: 365,
    });
    
    this.addRotationConfig({
      name: 'XMONEY_API_KEY',
      type: 'api_key',
      rotationIntervalDays: 365,
    });

    // OAuth Secrets - rotate annually
    this.addRotationConfig({
      name: 'GOOGLE_CLIENT_SECRET',
      type: 'oauth_secret',
      rotationIntervalDays: 365,
    });
  }

  /**
   * Add a rotation configuration
   */
  private addRotationConfig(config: SecretRotationConfig): void {
    this.rotationConfigs.set(config.name, config);
    this.scheduleRotation(config);
  }

  /**
   * Schedule automatic rotation for a secret
   */
  private scheduleRotation(config: SecretRotationConfig): void {
    const now = new Date();
    const nextRotation = config.lastRotated 
      ? new Date(config.lastRotated.getTime() + config.rotationIntervalDays * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + config.rotationIntervalDays * 24 * 60 * 60 * 1000);
    
    config.nextRotation = nextRotation;
    
    // Schedule rotation check daily
    const checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    
    const timeout = setInterval(() => {
      this.checkAndRotate(config.name);
    }, checkInterval);
    
    this.rotationSchedule.set(config.name, timeout);
    
    logger.info(`Scheduled rotation for ${config.name} on ${nextRotation.toISOString()}`);
  }

  /**
   * Check if a secret needs rotation and rotate if necessary
   */
  private async checkAndRotate(secretName: string): Promise<void> {
    const config = this.rotationConfigs.get(secretName);
    if (!config || !config.nextRotation) return;

    const now = new Date();
    if (now >= config.nextRotation) {
      logger.info(`Secret ${secretName} is due for rotation`);
      await this.rotateSecret(secretName);
    }
  }

  /**
   * Generate a new secret value based on type
   */
  private generateSecretValue(type: string): string {
    switch (type) {
      case 'jwt':
      case 'encryption_key':
        // Generate a 64-character hex string
        return crypto.randomBytes(32).toString('hex');
      
      case 'api_key':
        // Generate a UUID-like API key
        return `sk_${crypto.randomBytes(24).toString('hex')}`;
      
      case 'oauth_secret':
        // Generate a complex OAuth secret
        return crypto.randomBytes(32).toString('base64');
      
      default:
        throw new Error(`Unknown secret type: ${type}`);
    }
  }

  /**
   * Rotate a specific secret
   */
  async rotateSecret(secretName: string, customValue?: string): Promise<RotationResult> {
    try {
      const config = this.rotationConfigs.get(secretName);
      if (!config) {
        return {
          success: false,
          secretName,
          error: `No rotation configuration found for ${secretName}`,
        };
      }

      // Generate new secret value
      const newValue = customValue || this.generateSecretValue(config.type);

      // Validate and apply the new secret
      const rotated = await configValidationService.rotateSecret(secretName, newValue);
      
      if (rotated) {
        // Update rotation metadata
        config.lastRotated = new Date();
        config.nextRotation = new Date(
          config.lastRotated.getTime() + config.rotationIntervalDays * 24 * 60 * 60 * 1000
        );

        logger.info(`Successfully rotated secret: ${secretName}`);
        
        return {
          success: true,
          secretName,
          newValue: newValue.substring(0, 8) + '****', // Partial mask for logging
        };
      } else {
        return {
          success: false,
          secretName,
          error: 'Failed to apply new secret value',
        };
      }
    } catch (error) {
      logger.error(`Error rotating secret ${secretName}:`, error);
      return {
        success: false,
        secretName,
        error: String(error),
      };
    }
  }

  /**
   * Batch rotate multiple secrets
   */
  async rotateMultipleSecrets(secretNames: string[]): Promise<RotationResult[]> {
    const results: RotationResult[] = [];
    
    for (const secretName of secretNames) {
      const result = await this.rotateSecret(secretName);
      results.push(result);
      
      // Add delay between rotations to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Get rotation status for all configured secrets
   */
  getRotationStatus(): Array<{
    name: string;
    type: string;
    lastRotated?: Date;
    nextRotation?: Date;
    daysUntilRotation: number;
    isOverdue: boolean;
  }> {
    const status: Array<{
      name: string;
      type: string;
      lastRotated?: Date;
      nextRotation?: Date;
      daysUntilRotation: number;
      isOverdue: boolean;
    }> = [];
    const now = new Date();
    
    for (const [name, config] of this.rotationConfigs.entries()) {
      const daysUntilRotation = config.nextRotation 
        ? Math.floor((config.nextRotation.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        : config.rotationIntervalDays;
      
      const item: {
        name: string;
        type: string;
        lastRotated?: Date;
        nextRotation?: Date;
        daysUntilRotation: number;
        isOverdue: boolean;
      } = {
        name,
        type: config.type,
        daysUntilRotation,
        isOverdue: daysUntilRotation < 0,
      };
      
      if (config.lastRotated) {
        item.lastRotated = config.lastRotated;
      }
      if (config.nextRotation) {
        item.nextRotation = config.nextRotation;
      }
      
      status.push(item);
    }
    
    return status.sort((a, b) => a.daysUntilRotation - b.daysUntilRotation);
  }

  /**
   * Get secrets that need rotation soon (within 30 days)
   */
  getSecretsNeedingRotation(): string[] {
    const status = this.getRotationStatus();
    return status
      .filter(s => s.daysUntilRotation <= 30)
      .map(s => s.name);
  }

  /**
   * Clean up scheduled rotations
   */
  cleanup(): void {
    for (const timeout of this.rotationSchedule.values()) {
      clearInterval(timeout);
    }
    this.rotationSchedule.clear();
  }
}

// Export singleton instance
export const secretRotationService = new SecretRotationService();

// Export types
export type { SecretRotationConfig, RotationResult };