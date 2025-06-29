/**
 * Environment variables validation schema for backend API
 * Ensures all required environment variables are present and valid
 */
export declare const env: Readonly<{
    NODE_ENV: "development" | "test" | "production";
    PORT: number;
    API_BASE_URL: string;
    DATABASE_URL: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_KEY: string;
    REDIS_URL: string;
    JWT_ACCESS_SECRET: string;
    JWT_REFRESH_SECRET: string;
    JWT_ACCESS_EXPIRY: string;
    JWT_REFRESH_EXPIRY: string;
    ADMEDIACARDS_API_KEY: string;
    ADMEDIACARDS_API_SECRET: string;
    ADMEDIACARDS_BASE_URL: string;
    ADMEDIACARDS_WEBHOOK_SECRET: string;
    ADMEDIACARDS_ACCOUNT_ID: string;
    ADMEDIACARDS_TEST_MODE: boolean;
    ADMEDIACARDS_MAX_TEST_CARDS: number;
    XMONEY_API_KEY: string;
    XMONEY_WEBHOOK_SECRET: string;
    XMONEY_USE_LIVE: boolean;
    XMONEY_LIVE_API_URL: string;
    XMONEY_SANDBOX_API_URL: string;
    XMONEY_API_TIMEOUT: number;
    XMONEY_RETURN_URL: string;
    XMONEY_CANCEL_URL: string;
    XMONEY_CALLBACK_URL: string;
    DEFAULT_COUNTRY_CODE: string;
    MIN_DEPOSIT_AMOUNT: number;
    MAX_DEPOSIT_AMOUNT: number;
    WITHDRAWAL_FEE_PERCENTAGE: number;
    EXCHANGE_RATE_CACHE_TTL_MS: number;
    KYC_PROVIDER: "sumsub" | "jumio";
    KYC_API_URL: string;
    KYC_API_KEY: string;
    KYC_SECRET_KEY: string;
    SENDGRID_API_KEY: string;
    RESEND_API_KEY: string;
    BREVO_API_KEY: string;
    FROM_EMAIL: string;
    FROM_NAME: string;
    INVOICE_FROM_EMAIL: string;
    INVOICE_FROM_NAME: string;
    TWILIO_ACCOUNT_SID: string;
    TWILIO_AUTH_TOKEN: string;
    TWILIO_PHONE_NUMBER: string;
    ENCRYPTION_KEY: string;
    BCRYPT_ROUNDS: number;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    LOG_LEVEL: "error" | "warn" | "info" | "debug";
    SENTRY_DSN: string;
    ALLOWED_ORIGINS: string;
    ENABLE_DEBUG_LOGS: boolean;
    MOCK_EXTERNAL_APIS: boolean;
    ENABLE_REGISTRATION: boolean;
    ENABLE_CARD_CREATION: boolean;
    ENABLE_CRYPTO_DEPOSITS: boolean;
    ENABLE_KYC_VERIFICATION: boolean;
    MAINTENANCE_MODE: boolean;
    SKIP_EMAIL_VERIFICATION: boolean;
    SKIP_KYC_IN_DEV: boolean;
    MAX_ACTIVE_CARDS_PER_USER: number;
    DEFAULT_CARD_EXPIRY_YEARS: number;
    DEFAULT_CURRENCY: string;
    REQUIRE_COMPLETE_PROFILE: boolean;
    DEFAULT_USER_FIRST_NAME: string;
    DEFAULT_USER_LAST_NAME: string;
    DEFAULT_USER_ADDRESS: string;
    DEFAULT_USER_CITY: string;
    DEFAULT_USER_STATE: string;
    DEFAULT_USER_ZIP: string;
    DEFAULT_USER_COUNTRY: string;
    DEFAULT_USER_PHONE: string;
    TEST_CARD_ID_START: number;
    TEST_TRANSACTION_ID_START: number;
    TEST_BIN_MASTERCARD: string;
    TEST_BIN_VISA: string;
    MAX_FILE_SIZE: number;
    ALLOWED_FILE_TYPES: string;
    ADMEDIACARDS_WEBHOOK_URL: string;
    XMONEY_WEBHOOK_URL: string;
} & import("envalid").CleanedEnvAccessors>;
export type Env = typeof env;
export declare const database: {
    readonly url: string;
    readonly supabaseUrl: string;
    readonly supabaseServiceKey: string;
};
export declare const redis: {
    readonly url: string;
};
export declare const jwt: {
    readonly accessSecret: string;
    readonly refreshSecret: string;
    readonly accessExpiry: string;
    readonly refreshExpiry: string;
};
export declare const admediacards: {
    readonly apiKey: string;
    readonly apiSecret: string;
    readonly baseUrl: string;
    readonly webhookSecret: string;
    readonly accountId: string;
    readonly webhookUrl: string;
    readonly testMode: boolean;
    readonly maxTestCards: number;
};
export declare const xmoney: {
    readonly apiKey: string;
    readonly webhookSecret: string;
    readonly useLive: boolean;
    readonly liveApiUrl: string;
    readonly sandboxApiUrl: string;
    readonly apiTimeout: number;
    readonly returnUrl: string;
    readonly cancelUrl: string;
    readonly callbackUrl: string;
};
export declare const crypto: {
    readonly defaultCountryCode: string;
    readonly minDepositAmount: number;
    readonly maxDepositAmount: number;
    readonly withdrawalFeePercentage: number;
    readonly exchangeRateCacheTtlMs: number;
};
export declare const kyc: {
    readonly provider: "sumsub" | "jumio";
    readonly apiUrl: string;
    readonly apiKey: string;
    readonly secretKey: string;
};
export declare const email: {
    readonly apiKey: string;
    readonly fromEmail: string;
    readonly fromName: string;
    readonly invoiceFromEmail: string;
    readonly invoiceFromName: string;
};
export declare const sms: {
    readonly accountSid: string;
    readonly authToken: string;
    readonly phoneNumber: string;
};
export declare const security: {
    readonly encryptionKey: string;
    readonly bcryptRounds: number;
};
export declare const rateLimit: {
    readonly windowMs: number;
    readonly maxRequests: number;
};
export declare const logging: {
    readonly level: "error" | "warn" | "info" | "debug";
    readonly sentryDsn: string;
};
export declare const features: {
    readonly enableDebugLogs: boolean;
    readonly mockExternalApis: boolean;
    readonly enableRegistration: boolean;
    readonly enableCardCreation: boolean;
    readonly enableCryptoDeposits: boolean;
    readonly enableKycVerification: boolean;
    readonly maintenanceMode: boolean;
    readonly skipEmailVerification: boolean;
    readonly skipKycInDev: boolean;
};
export declare const upload: {
    readonly maxFileSize: number;
    readonly allowedFileTypes: string[];
};
export declare const cardConfig: {
    readonly maxActiveCardsPerUser: number;
    readonly defaultExpiryYears: number;
    readonly defaultCurrency: string;
    readonly requireCompleteProfile: boolean;
};
export declare const defaultUserData: {
    readonly firstName: string;
    readonly lastName: string;
    readonly address: string;
    readonly city: string;
    readonly state: string;
    readonly zip: string;
    readonly country: string;
    readonly phone: string;
};
export declare const testConfig: {
    readonly cardIdStart: number;
    readonly transactionIdStart: number;
    readonly binMastercard: string;
    readonly binVisa: string;
};
//# sourceMappingURL=env.d.ts.map