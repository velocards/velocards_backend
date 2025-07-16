"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConfig = exports.defaultUserData = exports.cardConfig = exports.upload = exports.features = exports.logging = exports.rateLimit = exports.security = exports.sms = exports.email = exports.kyc = exports.crypto = exports.xmoney = exports.admediacards = exports.jwt = exports.redis = exports.database = exports.env = void 0;
const envalid_1 = require("envalid");
/**
 * Environment variables validation schema for backend API
 * Ensures all required environment variables are present and valid
 */
exports.env = (0, envalid_1.cleanEnv)(process.env, {
    // Application Environment
    NODE_ENV: (0, envalid_1.str)({ choices: ['development', 'test', 'production'] }),
    PORT: (0, envalid_1.port)({ default: 3001 }),
    API_BASE_URL: (0, envalid_1.url)(),
    // Database Configuration
    DATABASE_URL: (0, envalid_1.str)(),
    SUPABASE_URL: (0, envalid_1.url)(),
    SUPABASE_SERVICE_KEY: (0, envalid_1.str)(),
    // Redis Configuration
    REDIS_URL: (0, envalid_1.str)(),
    // JWT Configuration
    JWT_ACCESS_SECRET: (0, envalid_1.str)(),
    JWT_REFRESH_SECRET: (0, envalid_1.str)(),
    JWT_ACCESS_EXPIRY: (0, envalid_1.str)({ default: '15m' }),
    JWT_REFRESH_EXPIRY: (0, envalid_1.str)({ default: '7d' }),
    // External API Keys (Optional for development)
    ADMEDIACARDS_API_KEY: (0, envalid_1.str)({ default: 'mock_api_key' }),
    ADMEDIACARDS_API_SECRET: (0, envalid_1.str)({ default: 'mock_api_secret' }),
    ADMEDIACARDS_BASE_URL: (0, envalid_1.str)({ default: 'https://api.admediacards.com/v1' }),
    ADMEDIACARDS_WEBHOOK_SECRET: (0, envalid_1.str)({ default: 'mock_webhook_secret' }),
    ADMEDIACARDS_ACCOUNT_ID: (0, envalid_1.str)({ default: 'mock_account_id' }),
    ADMEDIACARDS_TEST_MODE: (0, envalid_1.bool)({ default: true }),
    ADMEDIACARDS_MAX_TEST_CARDS: (0, envalid_1.num)({ default: 1 }),
    XMONEY_API_KEY: (0, envalid_1.str)(),
    XMONEY_WEBHOOK_SECRET: (0, envalid_1.str)(),
    XMONEY_USE_LIVE: (0, envalid_1.bool)({ default: false }),
    XMONEY_LIVE_API_URL: (0, envalid_1.str)({ default: 'https://merchants.api.crypto.xmoney.com/api' }),
    XMONEY_SANDBOX_API_URL: (0, envalid_1.str)({ default: 'https://merchants.api.sandbox.crypto.xmoney.com/api' }),
    XMONEY_API_TIMEOUT: (0, envalid_1.num)({ default: 30000 }),
    XMONEY_RETURN_URL: (0, envalid_1.str)({ default: 'http://localhost:3000/crypto/success' }),
    XMONEY_CANCEL_URL: (0, envalid_1.str)({ default: 'http://localhost:3000/crypto/cancel' }),
    XMONEY_CALLBACK_URL: (0, envalid_1.str)({ default: 'https://your-ngrok-url.ngrok.io/api/v1/webhooks/xmoney' }),
    // Crypto business configuration
    DEFAULT_COUNTRY_CODE: (0, envalid_1.str)({ default: 'US' }),
    MIN_DEPOSIT_AMOUNT: (0, envalid_1.num)({ default: 10 }),
    MAX_DEPOSIT_AMOUNT: (0, envalid_1.num)({ default: 10000 }),
    WITHDRAWAL_FEE_PERCENTAGE: (0, envalid_1.num)({ default: 0.02 }),
    EXCHANGE_RATE_CACHE_TTL_MS: (0, envalid_1.num)({ default: 300000 }), // 5 minutes
    // KYC Provider (Optional for development)
    KYC_PROVIDER: (0, envalid_1.str)({ choices: ['sumsub', 'jumio'], default: 'sumsub' }),
    KYC_API_URL: (0, envalid_1.url)({ default: 'https://api.sumsub.com' }),
    KYC_API_KEY: (0, envalid_1.str)({ default: 'mock_kyc_key' }),
    KYC_SECRET_KEY: (0, envalid_1.str)({ default: 'mock_kyc_secret' }),
    // Email Service (Optional for development)
    SENDGRID_API_KEY: (0, envalid_1.str)({ default: 'mock_sendgrid_key' }),
    RESEND_API_KEY: (0, envalid_1.str)({ default: '' }),
    BREVO_API_KEY: (0, envalid_1.str)({ default: '' }),
    FROM_EMAIL: (0, envalid_1.email)({ default: 'noreply@velocards.com' }),
    FROM_NAME: (0, envalid_1.str)({ default: 'VeloCards' }),
    // Invoice Email Configuration
    INVOICE_FROM_EMAIL: (0, envalid_1.email)({ default: 'invoices@velocards.com' }),
    INVOICE_FROM_NAME: (0, envalid_1.str)({ default: 'VeloCards Finance' }),
    FRONTEND_URL: (0, envalid_1.url)({ default: "http://localhost:3000" }),
    // SMS Service (Optional for development)
    TWILIO_ACCOUNT_SID: (0, envalid_1.str)({ default: 'mock_twilio_sid' }),
    TWILIO_AUTH_TOKEN: (0, envalid_1.str)({ default: 'mock_twilio_token' }),
    TWILIO_PHONE_NUMBER: (0, envalid_1.str)({ default: '+1234567890' }),
    // Security
    ENCRYPTION_KEY: (0, envalid_1.str)(),
    BCRYPT_ROUNDS: (0, envalid_1.num)({ default: 12 }),
    // Cloudflare Turnstile
    TURNSTILE_SECRET_KEY: (0, envalid_1.str)({ default: '' }),
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: (0, envalid_1.num)({ default: 900000 }), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: (0, envalid_1.num)({ default: 100 }),
    // Logging and Monitoring
    LOG_LEVEL: (0, envalid_1.str)({
        choices: ['error', 'warn', 'info', 'debug'],
        default: 'info'
    }),
    SENTRY_DSN: (0, envalid_1.str)({ default: '' }),
    // CORS
    ALLOWED_ORIGINS: (0, envalid_1.str)({ default: 'http://localhost:3000' }),
    // Google OAuth Configuration
    GOOGLE_CLIENT_ID: (0, envalid_1.str)({ default: '' }),
    GOOGLE_CLIENT_SECRET: (0, envalid_1.str)({ default: '' }),
    GOOGLE_REDIRECT_URI: (0, envalid_1.url)({ default: 'https://api.velocards.com/api/v1/auth/google/callback' }),
    // Feature Flags
    ENABLE_DEBUG_LOGS: (0, envalid_1.bool)({ default: false }),
    MOCK_EXTERNAL_APIS: (0, envalid_1.bool)({ default: false }),
    ENABLE_REGISTRATION: (0, envalid_1.bool)({ default: true }),
    ENABLE_CARD_CREATION: (0, envalid_1.bool)({ default: true }),
    ENABLE_CRYPTO_DEPOSITS: (0, envalid_1.bool)({ default: true }),
    ENABLE_KYC_VERIFICATION: (0, envalid_1.bool)({ default: true }),
    MAINTENANCE_MODE: (0, envalid_1.bool)({ default: false }),
    // Development/Testing
    SKIP_EMAIL_VERIFICATION: (0, envalid_1.bool)({ default: false }),
    SKIP_KYC_IN_DEV: (0, envalid_1.bool)({ default: false }),
    // Card Configuration
    MAX_ACTIVE_CARDS_PER_USER: (0, envalid_1.num)({ default: 10 }),
    DEFAULT_CARD_EXPIRY_YEARS: (0, envalid_1.num)({ default: 3 }),
    DEFAULT_CURRENCY: (0, envalid_1.str)({ default: 'USD' }),
    REQUIRE_COMPLETE_PROFILE: (0, envalid_1.bool)({ default: true }),
    // Default User Data (development only)
    DEFAULT_USER_FIRST_NAME: (0, envalid_1.str)({ default: 'Card' }),
    DEFAULT_USER_LAST_NAME: (0, envalid_1.str)({ default: 'Holder' }),
    DEFAULT_USER_ADDRESS: (0, envalid_1.str)({ default: '123 Main St' }),
    DEFAULT_USER_CITY: (0, envalid_1.str)({ default: 'New York' }),
    DEFAULT_USER_STATE: (0, envalid_1.str)({ default: 'NY' }),
    DEFAULT_USER_ZIP: (0, envalid_1.str)({ default: '10001' }),
    DEFAULT_USER_COUNTRY: (0, envalid_1.str)({ default: 'US' }),
    DEFAULT_USER_PHONE: (0, envalid_1.str)({ default: '+12125551234' }),
    // Test Configuration
    TEST_CARD_ID_START: (0, envalid_1.num)({ default: 100000 }),
    TEST_TRANSACTION_ID_START: (0, envalid_1.num)({ default: 200000 }),
    TEST_BIN_MASTERCARD: (0, envalid_1.str)({ default: '516830' }),
    TEST_BIN_VISA: (0, envalid_1.str)({ default: '428777' }),
    // File Upload
    MAX_FILE_SIZE: (0, envalid_1.num)({ default: 5242880 }), // 5MB
    ALLOWED_FILE_TYPES: (0, envalid_1.str)({ default: 'image/jpeg,image/png,application/pdf' }),
    // Webhook URLs (Optional for development)
    ADMEDIACARDS_WEBHOOK_URL: (0, envalid_1.url)({ default: 'https://your-domain.com/api/webhooks/admediacards' }),
    XMONEY_WEBHOOK_URL: (0, envalid_1.url)({ default: 'https://your-domain.com/api/webhooks/xmoney' }),
});
// Export individual environment groups for easier access
exports.database = {
    url: exports.env.DATABASE_URL,
    supabaseUrl: exports.env.SUPABASE_URL,
    supabaseServiceKey: exports.env.SUPABASE_SERVICE_KEY,
};
exports.redis = {
    url: exports.env.REDIS_URL,
};
exports.jwt = {
    accessSecret: exports.env.JWT_ACCESS_SECRET,
    refreshSecret: exports.env.JWT_REFRESH_SECRET,
    accessExpiry: exports.env.JWT_ACCESS_EXPIRY,
    refreshExpiry: exports.env.JWT_REFRESH_EXPIRY,
};
exports.admediacards = {
    apiKey: exports.env.ADMEDIACARDS_API_KEY,
    apiSecret: exports.env.ADMEDIACARDS_API_SECRET,
    baseUrl: exports.env.ADMEDIACARDS_BASE_URL,
    webhookSecret: exports.env.ADMEDIACARDS_WEBHOOK_SECRET,
    accountId: exports.env.ADMEDIACARDS_ACCOUNT_ID,
    webhookUrl: exports.env.ADMEDIACARDS_WEBHOOK_URL,
    testMode: exports.env.ADMEDIACARDS_TEST_MODE,
    maxTestCards: exports.env.ADMEDIACARDS_MAX_TEST_CARDS,
};
exports.xmoney = {
    apiKey: exports.env.XMONEY_API_KEY,
    webhookSecret: exports.env.XMONEY_WEBHOOK_SECRET,
    useLive: exports.env.XMONEY_USE_LIVE,
    liveApiUrl: exports.env.XMONEY_LIVE_API_URL,
    sandboxApiUrl: exports.env.XMONEY_SANDBOX_API_URL,
    apiTimeout: exports.env.XMONEY_API_TIMEOUT,
    returnUrl: exports.env.XMONEY_RETURN_URL,
    cancelUrl: exports.env.XMONEY_CANCEL_URL,
    callbackUrl: exports.env.XMONEY_CALLBACK_URL,
};
exports.crypto = {
    defaultCountryCode: exports.env.DEFAULT_COUNTRY_CODE,
    minDepositAmount: exports.env.MIN_DEPOSIT_AMOUNT,
    maxDepositAmount: exports.env.MAX_DEPOSIT_AMOUNT,
    withdrawalFeePercentage: exports.env.WITHDRAWAL_FEE_PERCENTAGE,
    exchangeRateCacheTtlMs: exports.env.EXCHANGE_RATE_CACHE_TTL_MS,
};
exports.kyc = {
    provider: exports.env.KYC_PROVIDER,
    apiUrl: exports.env.KYC_API_URL,
    apiKey: exports.env.KYC_API_KEY,
    secretKey: exports.env.KYC_SECRET_KEY,
};
exports.email = {
    apiKey: exports.env.SENDGRID_API_KEY,
    fromEmail: exports.env.FROM_EMAIL,
    fromName: exports.env.FROM_NAME,
    invoiceFromEmail: exports.env.INVOICE_FROM_EMAIL,
    invoiceFromName: exports.env.INVOICE_FROM_NAME,
};
exports.sms = {
    accountSid: exports.env.TWILIO_ACCOUNT_SID,
    authToken: exports.env.TWILIO_AUTH_TOKEN,
    phoneNumber: exports.env.TWILIO_PHONE_NUMBER,
};
exports.security = {
    encryptionKey: exports.env.ENCRYPTION_KEY,
    bcryptRounds: exports.env.BCRYPT_ROUNDS,
};
exports.rateLimit = {
    windowMs: exports.env.RATE_LIMIT_WINDOW_MS,
    maxRequests: exports.env.RATE_LIMIT_MAX_REQUESTS,
};
exports.logging = {
    level: exports.env.LOG_LEVEL,
    sentryDsn: exports.env.SENTRY_DSN,
};
exports.features = {
    enableDebugLogs: exports.env.ENABLE_DEBUG_LOGS,
    mockExternalApis: exports.env.MOCK_EXTERNAL_APIS,
    enableRegistration: exports.env.ENABLE_REGISTRATION,
    enableCardCreation: exports.env.ENABLE_CARD_CREATION,
    enableCryptoDeposits: exports.env.ENABLE_CRYPTO_DEPOSITS,
    enableKycVerification: exports.env.ENABLE_KYC_VERIFICATION,
    maintenanceMode: exports.env.MAINTENANCE_MODE,
    skipEmailVerification: exports.env.SKIP_EMAIL_VERIFICATION,
    skipKycInDev: exports.env.SKIP_KYC_IN_DEV,
};
exports.upload = {
    maxFileSize: exports.env.MAX_FILE_SIZE,
    allowedFileTypes: exports.env.ALLOWED_FILE_TYPES.split(','),
};
// Card configuration
exports.cardConfig = {
    maxActiveCardsPerUser: exports.env.MAX_ACTIVE_CARDS_PER_USER,
    defaultExpiryYears: exports.env.DEFAULT_CARD_EXPIRY_YEARS,
    defaultCurrency: exports.env.DEFAULT_CURRENCY,
    requireCompleteProfile: exports.env.REQUIRE_COMPLETE_PROFILE,
};
// Default user data (for development/testing only)
exports.defaultUserData = {
    firstName: exports.env.DEFAULT_USER_FIRST_NAME,
    lastName: exports.env.DEFAULT_USER_LAST_NAME,
    address: exports.env.DEFAULT_USER_ADDRESS,
    city: exports.env.DEFAULT_USER_CITY,
    state: exports.env.DEFAULT_USER_STATE,
    zip: exports.env.DEFAULT_USER_ZIP,
    country: exports.env.DEFAULT_USER_COUNTRY,
    phone: exports.env.DEFAULT_USER_PHONE,
};
// Test configuration
exports.testConfig = {
    cardIdStart: exports.env.TEST_CARD_ID_START,
    transactionIdStart: exports.env.TEST_TRANSACTION_ID_START,
    binMastercard: exports.env.TEST_BIN_MASTERCARD,
    binVisa: exports.env.TEST_BIN_VISA,
};
//# sourceMappingURL=env.js.map