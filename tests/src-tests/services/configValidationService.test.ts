import { configValidationService } from '../../../src/services/configValidationService';

describe('ConfigValidationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('validateEnvironment', () => {
    it('should validate a complete valid environment', async () => {
      // Set up a complete valid environment
      process.env = {
        NODE_ENV: 'test',
        PORT: '3001',
        API_BASE_URL: 'http://localhost:3001',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_KEY: 'test-key',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        ADMEDIACARDS_API_KEY: 'test-key',
        ADMEDIACARDS_BASE_URL: 'https://api.test.com',
        ADMEDIACARDS_ACCOUNT_ID: '123',
        ADMEDIACARDS_TEST_MODE: 'true',
        ADMEDIACARDS_MAX_TEST_CARDS: '100',
        XMONEY_API_KEY: 'test-key',
        XMONEY_WEBHOOK_SECRET: 'test-secret',
        XMONEY_USE_LIVE: 'false',
        XMONEY_API_TIMEOUT: '30000',
        XMONEY_RETURN_URL: 'http://localhost:3000/success',
        XMONEY_CANCEL_URL: 'http://localhost:3000/cancel',
        XMONEY_CALLBACK_URL: 'http://localhost:3001/webhook',
        DEFAULT_COUNTRY_CODE: 'US',
        MIN_DEPOSIT_AMOUNT: '10',
        MAX_DEPOSIT_AMOUNT: '10000',
        WITHDRAWAL_FEE_PERCENTAGE: '0.02',
        EXCHANGE_RATE_CACHE_TTL_MS: '300000',
        KYC_PROVIDER: 'sumsub',
        KYC_API_KEY: 'test-key',
        KYC_SECRET_KEY: 'test-secret',
        RESEND_API_KEY: 'test-key',
        SENDGRID_API_KEY: 'test-key',
        FROM_EMAIL: 'test@example.com',
        FROM_NAME: 'Test',
        INVOICE_FROM_EMAIL: 'invoice@example.com',
        INVOICE_FROM_NAME: 'Test Invoice',
        FRONTEND_URL: 'http://localhost:3000',
        TWILIO_ACCOUNT_SID: 'test-sid',
        TWILIO_AUTH_TOKEN: 'test-token',
        TWILIO_PHONE_NUMBER: '+1234567890',
        ENCRYPTION_KEY: 'c'.repeat(32),
        TURNSTILE_SECRET_KEY: 'test-key',
        SENTRY_DSN: 'https://test@sentry.io/123',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-secret',
        GOOGLE_REDIRECT_URI: 'http://localhost:3001/callback',
        ENABLE_DEBUG_LOGS: 'false',
        MOCK_EXTERNAL_APIS: 'false',
        ENABLE_REGISTRATION: 'true',
        ENABLE_CARD_CREATION: 'true',
        ENABLE_CRYPTO_DEPOSITS: 'true',
        ENABLE_KYC_VERIFICATION: 'false',
        MAINTENANCE_MODE: 'false',
      };

      const result = await configValidationService.validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should fail validation with missing required fields', async () => {
      process.env = {
        NODE_ENV: 'test',
        // Missing required fields
      };

      const result = await configValidationService.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.size).toBeGreaterThan(0);
    });

    it('should fail validation with invalid field types', async () => {
      process.env = {
        ...process.env,
        NODE_ENV: 'invalid', // Invalid enum value
        PORT: 'not-a-number',
        API_BASE_URL: 'not-a-url',
      };

      const result = await configValidationService.validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should return warnings for production misconfigurations', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['ENABLE_DEBUG_LOGS'] = 'true';
      process.env['MOCK_EXTERNAL_APIS'] = 'true';

      const result = await configValidationService.validateEnvironment();

      if (result.valid) {
        expect(result.warnings).toBeDefined();
        expect(result.warnings?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('validateCategory', () => {
    it('should validate a specific category', () => {
      process.env = {
        NODE_ENV: 'test',
        PORT: '3001',
        API_BASE_URL: 'http://localhost:3001',
      };

      const result = configValidationService.validateCategory('Application');

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail validation for invalid category', () => {
      process.env = {
        NODE_ENV: 'invalid',
      };

      const result = configValidationService.validateCategory('Application');

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should handle unknown category', () => {
      const result = configValidationService.validateCategory('UnknownCategory');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown category: UnknownCategory');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const status = configValidationService.getHealthStatus();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('lastValidation');
      expect(status).toHaveProperty('categories');
      expect(status).toHaveProperty('secretsExpiring');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status.status);
    });
  });

  describe('getMaskedConfig', () => {
    it('should mask sensitive values', async () => {
      process.env = {
        NODE_ENV: 'test',
        PORT: '3001',
        API_BASE_URL: 'http://localhost:3001',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_KEY: 'super-secret-key-12345',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'very-secret-jwt-key-12345',
        JWT_REFRESH_SECRET: 'another-secret-jwt-key-12345',
        ADMEDIACARDS_API_KEY: 'api-key-12345',
        ADMEDIACARDS_BASE_URL: 'https://api.test.com',
        ADMEDIACARDS_ACCOUNT_ID: '123',
        ADMEDIACARDS_TEST_MODE: 'true',
        ADMEDIACARDS_MAX_TEST_CARDS: '100',
        XMONEY_API_KEY: 'xmoney-key-12345',
        XMONEY_WEBHOOK_SECRET: 'webhook-secret-12345',
        XMONEY_USE_LIVE: 'false',
        XMONEY_API_TIMEOUT: '30000',
        XMONEY_RETURN_URL: 'http://localhost:3000/success',
        XMONEY_CANCEL_URL: 'http://localhost:3000/cancel',
        XMONEY_CALLBACK_URL: 'http://localhost:3001/webhook',
        DEFAULT_COUNTRY_CODE: 'US',
        MIN_DEPOSIT_AMOUNT: '10',
        MAX_DEPOSIT_AMOUNT: '10000',
        WITHDRAWAL_FEE_PERCENTAGE: '0.02',
        EXCHANGE_RATE_CACHE_TTL_MS: '300000',
        KYC_PROVIDER: 'sumsub',
        KYC_API_KEY: 'kyc-key-12345',
        KYC_SECRET_KEY: 'kyc-secret-12345',
        RESEND_API_KEY: 'resend-key-12345',
        SENDGRID_API_KEY: 'sendgrid-key-12345',
        FROM_EMAIL: 'test@example.com',
        FROM_NAME: 'Test',
        INVOICE_FROM_EMAIL: 'invoice@example.com',
        INVOICE_FROM_NAME: 'Test Invoice',
        FRONTEND_URL: 'http://localhost:3000',
        TWILIO_ACCOUNT_SID: 'twilio-sid-12345',
        TWILIO_AUTH_TOKEN: 'twilio-token-12345',
        TWILIO_PHONE_NUMBER: '+1234567890',
        ENCRYPTION_KEY: 'encryption-key-12345',
        TURNSTILE_SECRET_KEY: 'turnstile-key-12345',
        SENTRY_DSN: 'https://test@sentry.io/123',
        ALLOWED_ORIGINS: 'http://localhost:3000',
        GOOGLE_CLIENT_ID: 'google-client-12345',
        GOOGLE_CLIENT_SECRET: 'google-secret-12345',
        GOOGLE_REDIRECT_URI: 'http://localhost:3001/callback',
        ENABLE_DEBUG_LOGS: 'false',
        MOCK_EXTERNAL_APIS: 'false',
        ENABLE_REGISTRATION: 'true',
        ENABLE_CARD_CREATION: 'true',
        ENABLE_CRYPTO_DEPOSITS: 'true',
        ENABLE_KYC_VERIFICATION: 'false',
        MAINTENANCE_MODE: 'false',
      };

      await configValidationService.validateEnvironment();
      const masked = configValidationService.getMaskedConfig();

      // Check that sensitive values are masked (first 4 chars + ****)
      expect(masked['SUPABASE_SERVICE_KEY']).toMatch(/^.{4}\*{4}$/);
      expect(masked['JWT_ACCESS_SECRET']).toMatch(/^.{4}\*{4}$/);
      expect(masked['ADMEDIACARDS_API_KEY']).toMatch(/^.{4}\*{4}$/);
      
      // Check that non-sensitive values are not masked
      expect(masked['NODE_ENV']).toBe('test');
      expect(masked['PORT']).toBe(3001);
      expect(typeof masked['ENABLE_DEBUG_LOGS']).toBe('boolean');
    });
  });

  describe('exportConfigForEnvironment', () => {
    it('should export development configuration', () => {
      const config = configValidationService.exportConfigForEnvironment('development');

      expect(config).toContain('NODE_ENV=development');
      expect(config).toContain('ENABLE_DEBUG_LOGS=true');
      expect(config).toContain('SKIP_KYC_IN_DEV=true');
    });

    it('should export production configuration', () => {
      const config = configValidationService.exportConfigForEnvironment('production');

      expect(config).toContain('NODE_ENV=production');
      expect(config).toContain('ENABLE_DEBUG_LOGS=false');
      expect(config).toContain('USE_UPSTASH_REDIS=true');
    });
  });
});