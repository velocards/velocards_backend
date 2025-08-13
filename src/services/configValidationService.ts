import { z } from 'zod';
import logger from '../utils/logger';

/**
 * Configuration Validation Service
 * Provides comprehensive validation and management of environment variables
 * with Zod schemas, audit logging, and secret rotation support
 */

// ============================================
// Zod Schema Definitions
// ============================================

const applicationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().min(1).max(65535).default(3001),
  API_BASE_URL: z.string().url(),
});

const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
});

const redisSchema = z.object({
  REDIS_URL: z.string().min(1),
  REDIS_UPSTASH_URL: z.string().optional().default(''),
  USE_UPSTASH_REDIS: z.coerce.boolean().default(false),
});

const jwtSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('24h'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
});

const admediacardsSchema = z.object({
  ADMEDIACARDS_API_KEY: z.string().min(1),
  ADMEDIACARDS_API_SECRET: z.string().optional().default(''),
  ADMEDIACARDS_BASE_URL: z.string().url(),
  ADMEDIACARDS_WEBHOOK_SECRET: z.string().optional().default(''),
  ADMEDIACARDS_ACCOUNT_ID: z.string().min(1),
  ADMEDIACARDS_WEBHOOK_URL: z.string().url().default('https://api.velocards.com/api/webhooks/admediacards'),
  ADMEDIACARDS_TEST_MODE: z.coerce.boolean(),
  ADMEDIACARDS_MAX_TEST_CARDS: z.coerce.number().min(0),
});

const xmoneySchema = z.object({
  XMONEY_API_KEY: z.string().min(1),
  XMONEY_WEBHOOK_SECRET: z.string().min(1),
  XMONEY_USE_LIVE: z.coerce.boolean(),
  XMONEY_LIVE_API_URL: z.string().url().default('https://merchants.api.crypto.xmoney.com/api'),
  XMONEY_SANDBOX_API_URL: z.string().url().default('https://merchants.api.sandbox.crypto.xmoney.com/api'),
  XMONEY_API_TIMEOUT: z.coerce.number().min(1000).max(60000),
  XMONEY_RETURN_URL: z.string().url(),
  XMONEY_CANCEL_URL: z.string().url(),
  XMONEY_CALLBACK_URL: z.string().url(),
});

const cryptoConfigSchema = z.object({
  DEFAULT_COUNTRY_CODE: z.string().length(2),
  MIN_DEPOSIT_AMOUNT: z.coerce.number().min(1),
  MAX_DEPOSIT_AMOUNT: z.coerce.number().min(1),
  WITHDRAWAL_FEE_PERCENTAGE: z.coerce.number().min(0).max(1),
  EXCHANGE_RATE_CACHE_TTL_MS: z.coerce.number().min(0),
});

const kycSchema = z.object({
  KYC_PROVIDER: z.enum(['sumsub', 'jumio']),
  KYC_API_URL: z.string().url().default('https://api.sumsub.com'),
  KYC_API_KEY: z.string().min(1),
  KYC_SECRET_KEY: z.string().min(1),
});

const emailSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  SENDGRID_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
  FROM_NAME: z.string().min(1),
  INVOICE_FROM_EMAIL: z.string().email(),
  INVOICE_FROM_NAME: z.string().min(1),
  FRONTEND_URL: z.string().url(),
});

const smsSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().min(1),
});

const securitySchema = z.object({
  ENCRYPTION_KEY: z.string().min(32),
  BCRYPT_ROUNDS: z.coerce.number().min(10).max(20).default(12),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  CSRF_SECRET: z.string().optional().default(''),
  SESSION_SECRET: z.string().optional().default(''),
  TWO_FA_ENCRYPTION_KEY: z.string().optional().default(''),
});

const rateLimitSchema = z.object({
  RATE_LIMIT_WHITELIST_IPS: z.string().optional().default(''),
});

const adminSchema = z.object({
  ADMIN_EMAILS: z.string().optional().default(''),
});

const loggingSchema = z.object({
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().min(1),
  SENTRY_RELEASE: z.string().optional().default(''),
});

const corsSchema = z.object({
  ALLOWED_ORIGINS: z.string().min(1),
});

const googleOAuthSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
});

const featureFlagsSchema = z.object({
  ENABLE_DEBUG_LOGS: z.coerce.boolean(),
  MOCK_EXTERNAL_APIS: z.coerce.boolean(),
  ENABLE_REGISTRATION: z.coerce.boolean(),
  ENABLE_CARD_CREATION: z.coerce.boolean(),
  ENABLE_CRYPTO_DEPOSITS: z.coerce.boolean(),
  ENABLE_KYC_VERIFICATION: z.coerce.boolean(),
  MAINTENANCE_MODE: z.coerce.boolean(),
  SKIP_EMAIL_VERIFICATION: z.coerce.boolean().default(false),
  SKIP_KYC_IN_DEV: z.coerce.boolean().default(false),
});

const cardConfigSchema = z.object({
  MAX_ACTIVE_CARDS_PER_USER: z.coerce.number().min(1).default(10),
  DEFAULT_CARD_EXPIRY_YEARS: z.coerce.number().min(1).default(3),
  DEFAULT_CURRENCY: z.string().default('USD'),
  REQUIRE_COMPLETE_PROFILE: z.coerce.boolean().default(true),
});

const defaultUserDataSchema = z.object({
  DEFAULT_USER_FIRST_NAME: z.string().default('Card'),
  DEFAULT_USER_LAST_NAME: z.string().default('Holder'),
  DEFAULT_USER_ADDRESS: z.string().default('123 Main St'),
  DEFAULT_USER_CITY: z.string().default('New York'),
  DEFAULT_USER_STATE: z.string().default('NY'),
  DEFAULT_USER_ZIP: z.string().default('10001'),
  DEFAULT_USER_COUNTRY: z.string().default('US'),
  DEFAULT_USER_PHONE: z.string().default('+12125551234'),
});

const testConfigSchema = z.object({
  TEST_CARD_ID_START: z.coerce.number().default(100000),
  TEST_TRANSACTION_ID_START: z.coerce.number().default(200000),
  TEST_BIN_MASTERCARD: z.string().default('516830'),
  TEST_BIN_VISA: z.string().default('428777'),
});

const fileUploadSchema = z.object({
  MAX_FILE_SIZE: z.coerce.number().default(5242880),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,application/pdf'),
});

const repositoryFlagsSchema = z.object({
  USE_NEW_REPOSITORIE: z.coerce.boolean().optional().default(false),
  USE_NEW_AUDIT_LOG_REPO: z.coerce.boolean().optional().default(false),
  USE_NEW_CRYPTO_PRICE_REPO: z.coerce.boolean().optional().default(false),
  USE_NEW_CRYPTO_TRANSACTION_REPO: z.coerce.boolean().optional().default(false),
  USE_NEW_SECURITY_KEY_REPO: z.coerce.boolean().optional().default(false),
  USE_NEW_USER_BALANCE_LEDGER_REPO: z.coerce.boolean().optional().default(false),
});

const additionalConfigSchema = z.object({
  COMPANY_DOMAIN: z.string().optional().default('velocards.com'),
  GITHUB_TOKEN: z.string().optional().default(''),
});

// Complete environment schema
const envSchema = z.object({
  ...applicationSchema.shape,
  ...databaseSchema.shape,
  ...redisSchema.shape,
  ...jwtSchema.shape,
  ...admediacardsSchema.shape,
  ...xmoneySchema.shape,
  ...cryptoConfigSchema.shape,
  ...kycSchema.shape,
  ...emailSchema.shape,
  ...smsSchema.shape,
  ...securitySchema.shape,
  ...rateLimitSchema.shape,
  ...adminSchema.shape,
  ...loggingSchema.shape,
  ...corsSchema.shape,
  ...googleOAuthSchema.shape,
  ...featureFlagsSchema.shape,
  ...cardConfigSchema.shape,
  ...defaultUserDataSchema.shape,
  ...testConfigSchema.shape,
  ...fileUploadSchema.shape,
  ...repositoryFlagsSchema.shape,
  ...additionalConfigSchema.shape,
});

// Type inference
export type ValidatedEnv = z.infer<typeof envSchema>;

// ============================================
// Configuration Categories
// ============================================

interface ConfigCategory {
  name: string;
  schema: z.ZodObject<any>;
  sensitive?: boolean;
}

const configCategories: ConfigCategory[] = [
  { name: 'Application', schema: applicationSchema },
  { name: 'Database', schema: databaseSchema, sensitive: true },
  { name: 'Redis', schema: redisSchema, sensitive: true },
  { name: 'JWT', schema: jwtSchema, sensitive: true },
  { name: 'AdMediaCards', schema: admediacardsSchema, sensitive: true },
  { name: 'xMoney', schema: xmoneySchema, sensitive: true },
  { name: 'Crypto', schema: cryptoConfigSchema },
  { name: 'KYC', schema: kycSchema, sensitive: true },
  { name: 'Email', schema: emailSchema, sensitive: true },
  { name: 'SMS', schema: smsSchema, sensitive: true },
  { name: 'Security', schema: securitySchema, sensitive: true },
  { name: 'RateLimit', schema: rateLimitSchema },
  { name: 'Admin', schema: adminSchema },
  { name: 'Logging', schema: loggingSchema },
  { name: 'CORS', schema: corsSchema },
  { name: 'GoogleOAuth', schema: googleOAuthSchema, sensitive: true },
  { name: 'FeatureFlags', schema: featureFlagsSchema },
  { name: 'CardConfig', schema: cardConfigSchema },
  { name: 'DefaultUserData', schema: defaultUserDataSchema },
  { name: 'TestConfig', schema: testConfigSchema },
  { name: 'FileUpload', schema: fileUploadSchema },
  { name: 'RepositoryFlags', schema: repositoryFlagsSchema },
  { name: 'AdditionalConfig', schema: additionalConfigSchema },
];

// ============================================
// Validation Service Class
// ============================================

class ConfigValidationService {
  private validatedConfig: ValidatedEnv | null = null;
  private validationErrors: Map<string, string[]> = new Map();
  private lastValidationTime: Date | null = null;
  private secretRotationSchedule: Map<string, Date> = new Map();

  /**
   * Validate all environment variables
   */
  async validateEnvironment(): Promise<{
    valid: boolean;
    config?: ValidatedEnv;
    errors?: Map<string, string[]>;
    warnings?: string[];
  }> {
    this.validationErrors.clear();
    const warnings: string[] = [];

    try {
      // Validate complete schema
      const result = envSchema.safeParse(process.env);
      
      if (!result.success) {
        // Process errors by category
        for (const error of result.error.errors) {
          const path = error.path.join('.');
          if (!this.validationErrors.has(path)) {
            this.validationErrors.set(path, []);
          }
          this.validationErrors.get(path)!.push(error.message);
        }

        // Log errors by category
        for (const category of configCategories) {
          const categoryErrors = this.getCategoryErrors(category.name);
          if (categoryErrors.length > 0) {
            logger.error(`Configuration validation failed for ${category.name}:`, categoryErrors);
          }
        }

        return {
          valid: false,
          errors: this.validationErrors,
        };
      }

      this.validatedConfig = result.data;
      this.lastValidationTime = new Date();

      // Check for warnings
      warnings.push(...this.checkConfigurationWarnings(result.data));

      // Audit successful validation
      await this.auditConfigValidation(true);

      logger.info('Configuration validation successful');
      
      const returnValue: {
        valid: boolean;
        config?: ValidatedEnv;
        errors?: Map<string, string[]>;
        warnings?: string[];
      } = {
        valid: true,
        config: result.data,
      };
      
      if (warnings.length > 0) {
        returnValue.warnings = warnings;
      }
      
      return returnValue;
    } catch (error) {
      logger.error('Configuration validation error:', error);
      await this.auditConfigValidation(false, error);
      
      return {
        valid: false,
        errors: this.validationErrors,
      };
    }
  }

  /**
   * Get configuration with validation
   */
  getValidatedConfig(): ValidatedEnv {
    if (!this.validatedConfig) {
      throw new Error('Configuration not validated. Call validateEnvironment() first.');
    }
    return this.validatedConfig;
  }

  /**
   * Check specific configuration category
   */
  validateCategory(categoryName: string): { valid: boolean; errors?: string[] } {
    const category = configCategories.find(c => c.name === categoryName);
    if (!category) {
      return { valid: false, errors: [`Unknown category: ${categoryName}`] };
    }

    const result = category.schema.safeParse(process.env);
    if (!result.success) {
      return {
        valid: false,
        errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }

    return { valid: true };
  }

  /**
   * Get configuration health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastValidation: Date | null;
    categories: { [key: string]: boolean };
    secretsExpiring: string[];
  } {
    const categories: { [key: string]: boolean } = {};
    
    for (const category of configCategories) {
      const validation = this.validateCategory(category.name);
      categories[category.name] = validation.valid;
    }

    const unhealthyCount = Object.values(categories).filter(v => !v).length;
    const status = unhealthyCount === 0 ? 'healthy' : unhealthyCount > 3 ? 'unhealthy' : 'degraded';

    return {
      status,
      lastValidation: this.lastValidationTime,
      categories,
      secretsExpiring: this.getExpiringSecrets(),
    };
  }

  /**
   * Check for configuration warnings
   */
  private checkConfigurationWarnings(config: ValidatedEnv): string[] {
    const warnings: string[] = [];

    // Check for development settings in production
    if (config.NODE_ENV === 'production') {
      if (config.ENABLE_DEBUG_LOGS) {
        warnings.push('Debug logs are enabled in production');
      }
      if (config.MOCK_EXTERNAL_APIS) {
        warnings.push('External APIs are mocked in production');
      }
      if (!config.USE_UPSTASH_REDIS) {
        warnings.push('Consider using Upstash Redis in production');
      }
      if (config.SKIP_EMAIL_VERIFICATION) {
        warnings.push('Email verification is skipped in production');
      }
    }

    // Check for weak security settings
    if (config.BCRYPT_ROUNDS < 12) {
      warnings.push('Bcrypt rounds is below recommended minimum of 12');
    }
    if (config.JWT_ACCESS_SECRET.length < 64) {
      warnings.push('JWT access secret is shorter than recommended 64 characters');
    }
    if (config.JWT_REFRESH_SECRET.length < 64) {
      warnings.push('JWT refresh secret is shorter than recommended 64 characters');
    }

    // Check for test mode in production
    if (config.NODE_ENV === 'production' && config.ADMEDIACARDS_TEST_MODE) {
      warnings.push('AdMediaCards is in test mode in production');
    }

    return warnings;
  }

  /**
   * Get errors for a specific category
   */
  private getCategoryErrors(categoryName: string): string[] {
    const errors: string[] = [];
    for (const [key, messages] of this.validationErrors.entries()) {
      // Check if the key belongs to this category
      const category = configCategories.find(c => c.name === categoryName);
      if (category) {
        const categoryKeys = Object.keys(category.schema.shape);
        if (categoryKeys.includes(key)) {
          errors.push(`${key}: ${messages.join(', ')}`);
        }
      }
    }
    return errors;
  }

  /**
   * Schedule secret rotation
   */
  scheduleSecretRotation(secretName: string, rotationDate: Date): void {
    this.secretRotationSchedule.set(secretName, rotationDate);
    logger.info(`Scheduled rotation for ${secretName} on ${rotationDate.toISOString()}`);
  }

  /**
   * Get secrets expiring soon
   */
  private getExpiringSecrets(): string[] {
    const expiring: string[] = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const [secret, rotationDate] of this.secretRotationSchedule.entries()) {
      if (rotationDate <= thirtyDaysFromNow) {
        expiring.push(secret);
      }
    }

    return expiring;
  }

  /**
   * Rotate a specific secret
   */
  async rotateSecret(secretName: string, newValue: string): Promise<boolean> {
    try {
      // Validate the new value against the schema
      const tempEnv = { ...process.env, [secretName]: newValue } as any;
      const result = envSchema.safeParse(tempEnv);
      
      if (!result.success) {
        logger.error(`Failed to rotate secret ${secretName}: Invalid value`);
        return false;
      }

      // Update the environment variable
      process.env[secretName] = newValue;
      
      // Re-validate configuration
      await this.validateEnvironment();
      
      // Audit the rotation
      await this.auditSecretRotation(secretName, true);
      
      // Update rotation schedule
      const nextRotation = new Date();
      nextRotation.setMonth(nextRotation.getMonth() + 3); // Rotate quarterly
      this.scheduleSecretRotation(secretName, nextRotation);
      
      logger.info(`Successfully rotated secret: ${secretName}`);
      return true;
    } catch (error) {
      logger.error(`Error rotating secret ${secretName}:`, error);
      await this.auditSecretRotation(secretName, false, error);
      return false;
    }
  }

  /**
   * Audit configuration validation
   */
  private async auditConfigValidation(success: boolean, error?: any): Promise<void> {
    try {
      // Log configuration validation event
      logger.info('Configuration validation audit', {
        action: 'CONFIG_VALIDATION',
        success,
        timestamp: new Date().toISOString(),
        environment: process.env['NODE_ENV'],
        errorCount: this.validationErrors.size,
        error: error ? String(error) : undefined,
      });
    } catch (auditError) {
      logger.error('Failed to audit configuration validation:', auditError);
    }
  }

  /**
   * Audit secret rotation
   */
  private async auditSecretRotation(secretName: string, success: boolean, error?: any): Promise<void> {
    try {
      // Log secret rotation event
      logger.info('Secret rotation audit', {
        action: 'SECRET_ROTATION',
        success,
        secretName,
        timestamp: new Date().toISOString(),
        error: error ? String(error) : undefined,
      });
    } catch (auditError) {
      logger.error('Failed to audit secret rotation:', auditError);
    }
  }

  /**
   * Export configuration for environment
   */
  exportConfigForEnvironment(environment: 'development' | 'test' | 'production'): string {
    const config: string[] = [];
    config.push(`# Configuration for ${environment} environment`);
    config.push(`# Generated on ${new Date().toISOString()}`);
    config.push('');

    // Add environment-specific defaults
    config.push(`NODE_ENV=${environment}`);
    
    if (environment === 'development') {
      config.push('PORT=3001');
      config.push('API_BASE_URL=http://localhost:3001');
      config.push('ENABLE_DEBUG_LOGS=true');
      config.push('MOCK_EXTERNAL_APIS=false');
      config.push('SKIP_KYC_IN_DEV=true');
    } else if (environment === 'production') {
      config.push('PORT=3001');
      config.push('API_BASE_URL=https://api.velocards.com');
      config.push('ENABLE_DEBUG_LOGS=false');
      config.push('MOCK_EXTERNAL_APIS=false');
      config.push('USE_UPSTASH_REDIS=true');
    }

    return config.join('\n');
  }

  /**
   * Get masked configuration (for display)
   */
  getMaskedConfig(): Record<string, any> {
    const config = this.getValidatedConfig();
    const masked: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
      // Find if this key belongs to a sensitive category
      const isSensitive = configCategories.some(category => {
        if (!category.sensitive) return false;
        const categoryKeys = Object.keys(category.schema.shape);
        return categoryKeys.includes(key);
      });

      if (isSensitive && typeof value === 'string' && value.length > 4) {
        // Mask sensitive values
        masked[key] = value.substring(0, 4) + '****';
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}

// Export singleton instance
export const configValidationService = new ConfigValidationService();

// Export schema for use in other modules
export { envSchema, configCategories };