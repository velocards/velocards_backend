import { cleanEnv, str, num, bool, url, email as emailValidator, port } from 'envalid';

/**
 * Environment variables validation schema for backend API
 * Ensures all required environment variables are present and valid
 */
export const env = cleanEnv(process.env, {
  // Application Environment
  NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
  PORT: port({ default: 3001 }),
  API_BASE_URL: url(),

  // Database Configuration
  DATABASE_URL: str(),
  SUPABASE_URL: url(),
  SUPABASE_SERVICE_KEY: str(),

  // Redis Configuration
  REDIS_URL: str(),
  REDIS_UPSTASH_URL: str({ default: '' }), // Upstash Redis URL for production
  USE_UPSTASH_REDIS: bool({ default: false }), // Flag to switch between Railway/Upstash

  // JWT Configuration
  JWT_ACCESS_SECRET: str(),
  JWT_REFRESH_SECRET: str(),
  JWT_ACCESS_EXPIRY: str({ default: '24h' }),
  JWT_REFRESH_EXPIRY: str({ default: '7d' }),

  // External API Keys
  ADMEDIACARDS_API_KEY: str(),
  ADMEDIACARDS_API_SECRET: str({ default: '' }), // Optional - not in .env
  ADMEDIACARDS_BASE_URL: str(),
  ADMEDIACARDS_WEBHOOK_SECRET: str({ default: '' }), // Optional - not in .env
  ADMEDIACARDS_ACCOUNT_ID: str(),
  ADMEDIACARDS_TEST_MODE: bool(),
  ADMEDIACARDS_MAX_TEST_CARDS: num(),

  XMONEY_API_KEY: str(),
  XMONEY_WEBHOOK_SECRET: str(),
  XMONEY_USE_LIVE: bool(),
  XMONEY_LIVE_API_URL: str({ default: 'https://merchants.api.crypto.xmoney.com/api' }),
  XMONEY_SANDBOX_API_URL: str({ default: 'https://merchants.api.sandbox.crypto.xmoney.com/api' }),
  XMONEY_API_TIMEOUT: num(),
  XMONEY_RETURN_URL: str(),
  XMONEY_CANCEL_URL: str(),
  XMONEY_CALLBACK_URL: str(),
  
  // Crypto business configuration
  DEFAULT_COUNTRY_CODE: str(),
  MIN_DEPOSIT_AMOUNT: num(),
  MAX_DEPOSIT_AMOUNT: num(),
  WITHDRAWAL_FEE_PERCENTAGE: num(),
  EXCHANGE_RATE_CACHE_TTL_MS: num(),

  // KYC Provider
  KYC_PROVIDER: str({ choices: ['sumsub', 'jumio'] }),
  KYC_API_URL: url({ default: 'https://api.sumsub.com' }), // Standard Sumsub URL
  KYC_API_KEY: str(),
  KYC_SECRET_KEY: str(),

  // Email Service
  SENDGRID_API_KEY: str(),
  RESEND_API_KEY: str(),
  BREVO_API_KEY: str({ default: '' }), // Optional - not in .env
  FROM_EMAIL: emailValidator(),
  FROM_NAME: str(),
  
  // Invoice Email Configuration
  INVOICE_FROM_EMAIL: emailValidator(),
  INVOICE_FROM_NAME: str(),
  FRONTEND_URL: url(),

  // SMS Service
  TWILIO_ACCOUNT_SID: str(),
  TWILIO_AUTH_TOKEN: str(),
  TWILIO_PHONE_NUMBER: str(),

  // Security
  ENCRYPTION_KEY: str(),
  BCRYPT_ROUNDS: num({ default: 12 }),
  
  // Cloudflare Turnstile
  TURNSTILE_SECRET_KEY: str(),

  // Rate Limiting
  RATE_LIMIT_WHITELIST_IPS: str({ default: '' }), // Comma-separated list of IPs to bypass rate limiting
  
  // Admin Configuration
  ADMIN_EMAILS: str({ default: '' }), // Comma-separated list of admin emails

  // Logging and Monitoring
  LOG_LEVEL: str({ 
    choices: ['error', 'warn', 'info', 'debug'], 
    default: 'info' 
  }),
  SENTRY_DSN: str(),
  SENTRY_RELEASE: str({ default: '' }),

  // CORS
  ALLOWED_ORIGINS: str(),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: str(),
  GOOGLE_CLIENT_SECRET: str(),
  GOOGLE_REDIRECT_URI: url(),

  // Feature Flags
  ENABLE_DEBUG_LOGS: bool(),
  MOCK_EXTERNAL_APIS: bool(),
  ENABLE_REGISTRATION: bool(),
  ENABLE_CARD_CREATION: bool(),
  ENABLE_CRYPTO_DEPOSITS: bool(),
  ENABLE_KYC_VERIFICATION: bool(),
  MAINTENANCE_MODE: bool(),

  // Development/Testing
  SKIP_EMAIL_VERIFICATION: bool({ default: false }),
  SKIP_KYC_IN_DEV: bool({ default: false }),
  
  // Card Configuration
  MAX_ACTIVE_CARDS_PER_USER: num({ default: 10 }),
  DEFAULT_CARD_EXPIRY_YEARS: num({ default: 3 }),
  DEFAULT_CURRENCY: str({ default: 'USD' }),
  REQUIRE_COMPLETE_PROFILE: bool({ default: true }),
  
  // Default User Data (development only)
  DEFAULT_USER_FIRST_NAME: str({ default: 'Card' }),
  DEFAULT_USER_LAST_NAME: str({ default: 'Holder' }),
  DEFAULT_USER_ADDRESS: str({ default: '123 Main St' }),
  DEFAULT_USER_CITY: str({ default: 'New York' }),
  DEFAULT_USER_STATE: str({ default: 'NY' }),
  DEFAULT_USER_ZIP: str({ default: '10001' }),
  DEFAULT_USER_COUNTRY: str({ default: 'US' }),
  DEFAULT_USER_PHONE: str({ default: '+12125551234' }),
  
  // Test Configuration
  TEST_CARD_ID_START: num({ default: 100000 }),
  TEST_TRANSACTION_ID_START: num({ default: 200000 }),
  TEST_BIN_MASTERCARD: str({ default: '516830' }),
  TEST_BIN_VISA: str({ default: '428777' }),

  // File Upload
  MAX_FILE_SIZE: num({ default: 5242880 }), // 5MB
  ALLOWED_FILE_TYPES: str({ default: 'image/jpeg,image/png,application/pdf' }),

  // Webhook URLs
  ADMEDIACARDS_WEBHOOK_URL: url({ default: 'https://api.velocards.com/api/webhooks/admediacards' }),
  XMONEY_WEBHOOK_URL: url({ default: 'https://api.velocards.com/api/webhooks/xmoney' }),
});

export type Env = typeof env;

// Export individual environment groups for easier access
export const database = {
  url: env.DATABASE_URL,
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceKey: env.SUPABASE_SERVICE_KEY,
} as const;

export const redis = {
  url: env.REDIS_URL,
  upstashUrl: env.REDIS_UPSTASH_URL,
  useUpstash: env.USE_UPSTASH_REDIS,
} as const;

export const jwt = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiry: env.JWT_ACCESS_EXPIRY,
  refreshExpiry: env.JWT_REFRESH_EXPIRY,
} as const;

export const admediacards = {
  apiKey: env.ADMEDIACARDS_API_KEY,
  apiSecret: env.ADMEDIACARDS_API_SECRET,
  baseUrl: env.ADMEDIACARDS_BASE_URL,
  webhookSecret: env.ADMEDIACARDS_WEBHOOK_SECRET,
  accountId: env.ADMEDIACARDS_ACCOUNT_ID,
  webhookUrl: env.ADMEDIACARDS_WEBHOOK_URL,
  testMode: env.ADMEDIACARDS_TEST_MODE,
  maxTestCards: env.ADMEDIACARDS_MAX_TEST_CARDS,
} as const;

export const xmoney = {
  apiKey: env.XMONEY_API_KEY,
  webhookSecret: env.XMONEY_WEBHOOK_SECRET,
  useLive: env.XMONEY_USE_LIVE,
  liveApiUrl: env.XMONEY_LIVE_API_URL,
  sandboxApiUrl: env.XMONEY_SANDBOX_API_URL,
  apiTimeout: env.XMONEY_API_TIMEOUT,
  returnUrl: env.XMONEY_RETURN_URL,
  cancelUrl: env.XMONEY_CANCEL_URL,
  callbackUrl: env.XMONEY_CALLBACK_URL,
} as const;

export const crypto = {
  defaultCountryCode: env.DEFAULT_COUNTRY_CODE,
  minDepositAmount: env.MIN_DEPOSIT_AMOUNT,
  maxDepositAmount: env.MAX_DEPOSIT_AMOUNT,
  withdrawalFeePercentage: env.WITHDRAWAL_FEE_PERCENTAGE,
  exchangeRateCacheTtlMs: env.EXCHANGE_RATE_CACHE_TTL_MS,
} as const;

export const kyc = {
  provider: env.KYC_PROVIDER,
  apiUrl: env.KYC_API_URL,
  apiKey: env.KYC_API_KEY,
  secretKey: env.KYC_SECRET_KEY,
} as const;

export const email = {
  apiKey: env.SENDGRID_API_KEY,
  fromEmail: env.FROM_EMAIL,
  fromName: env.FROM_NAME,
  invoiceFromEmail: env.INVOICE_FROM_EMAIL,
  invoiceFromName: env.INVOICE_FROM_NAME,
} as const;

export const sms = {
  accountSid: env.TWILIO_ACCOUNT_SID,
  authToken: env.TWILIO_AUTH_TOKEN,
  phoneNumber: env.TWILIO_PHONE_NUMBER,
} as const;

export const security = {
  encryptionKey: env.ENCRYPTION_KEY,
  bcryptRounds: env.BCRYPT_ROUNDS,
} as const;

export const rateLimit = {
  whitelistIps: env.RATE_LIMIT_WHITELIST_IPS,
} as const;

export const logging = {
  level: env.LOG_LEVEL,
  sentryDsn: env.SENTRY_DSN,
  sentryRelease: env.SENTRY_RELEASE,
} as const;

export const features = {
  enableDebugLogs: env.ENABLE_DEBUG_LOGS,
  mockExternalApis: env.MOCK_EXTERNAL_APIS,
  enableRegistration: env.ENABLE_REGISTRATION,
  enableCardCreation: env.ENABLE_CARD_CREATION,
  enableCryptoDeposits: env.ENABLE_CRYPTO_DEPOSITS,
  enableKycVerification: env.ENABLE_KYC_VERIFICATION,
  maintenanceMode: env.MAINTENANCE_MODE,
  skipEmailVerification: env.SKIP_EMAIL_VERIFICATION,
  skipKycInDev: env.SKIP_KYC_IN_DEV,
} as const;

export const upload = {
  maxFileSize: env.MAX_FILE_SIZE,
  allowedFileTypes: env.ALLOWED_FILE_TYPES.split(','),
} as const;

// Card configuration
export const cardConfig = {
  maxActiveCardsPerUser: env.MAX_ACTIVE_CARDS_PER_USER,
  defaultExpiryYears: env.DEFAULT_CARD_EXPIRY_YEARS,
  defaultCurrency: env.DEFAULT_CURRENCY,
  requireCompleteProfile: env.REQUIRE_COMPLETE_PROFILE,
} as const;

// Default user data (for development/testing only)
export const defaultUserData = {
  firstName: env.DEFAULT_USER_FIRST_NAME,
  lastName: env.DEFAULT_USER_LAST_NAME,
  address: env.DEFAULT_USER_ADDRESS,
  city: env.DEFAULT_USER_CITY,
  state: env.DEFAULT_USER_STATE,
  zip: env.DEFAULT_USER_ZIP,
  country: env.DEFAULT_USER_COUNTRY,
  phone: env.DEFAULT_USER_PHONE,
} as const;

// Test configuration
export const testConfig = {
  cardIdStart: env.TEST_CARD_ID_START,
  transactionIdStart: env.TEST_TRANSACTION_ID_START,
  binMastercard: env.TEST_BIN_MASTERCARD,
  binVisa: env.TEST_BIN_VISA,
} as const;