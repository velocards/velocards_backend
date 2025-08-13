import { configValidationService, type ValidatedEnv } from '../services/configValidationService';
import logger from '../utils/logger';

/**
 * Environment configuration using Zod validation
 * This replaces the envalid-based configuration for better type safety
 * and more comprehensive validation
 */

let validatedEnv: ValidatedEnv | null = null;

/**
 * Initialize and validate environment configuration
 * This should be called at application startup
 */
export async function initializeConfig(): Promise<ValidatedEnv> {
  const validation = await configValidationService.validateEnvironment();
  
  if (!validation.valid) {
    const errorMessages: string[] = [];
    if (validation.errors) {
      for (const [key, messages] of validation.errors.entries()) {
        errorMessages.push(`${key}: ${messages.join(', ')}`);
      }
    }
    
    logger.error('Environment validation failed:', errorMessages);
    throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
  }

  if (validation.warnings && validation.warnings.length > 0) {
    logger.warn('Configuration warnings:', validation.warnings);
  }

  validatedEnv = validation.config!;
  logger.info('Environment configuration validated successfully');
  
  return validatedEnv;
}

/**
 * Get validated environment configuration
 * Throws if configuration hasn't been initialized
 */
export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    throw new Error('Environment not initialized. Call initializeConfig() first.');
  }
  return validatedEnv;
}

/**
 * Export environment variable groups for backward compatibility
 * These match the structure from the original env.ts file
 */

export const getDatabase = () => {
  const env = getEnv();
  return {
    url: env.DATABASE_URL,
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY,
  } as const;
};

export const getRedis = () => {
  const env = getEnv();
  return {
    url: env.REDIS_URL,
    upstashUrl: env.REDIS_UPSTASH_URL,
    useUpstash: env.USE_UPSTASH_REDIS,
  } as const;
};

export const getJwt = () => {
  const env = getEnv();
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  } as const;
};

export const getAdmediacards = () => {
  const env = getEnv();
  return {
    apiKey: env.ADMEDIACARDS_API_KEY,
    apiSecret: env.ADMEDIACARDS_API_SECRET,
    baseUrl: env.ADMEDIACARDS_BASE_URL,
    webhookSecret: env.ADMEDIACARDS_WEBHOOK_SECRET,
    accountId: env.ADMEDIACARDS_ACCOUNT_ID,
    webhookUrl: env.ADMEDIACARDS_WEBHOOK_URL,
    testMode: env.ADMEDIACARDS_TEST_MODE,
    maxTestCards: env.ADMEDIACARDS_MAX_TEST_CARDS,
  } as const;
};

export const getXmoney = () => {
  const env = getEnv();
  return {
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
};

export const getCrypto = () => {
  const env = getEnv();
  return {
    defaultCountryCode: env.DEFAULT_COUNTRY_CODE,
    minDepositAmount: env.MIN_DEPOSIT_AMOUNT,
    maxDepositAmount: env.MAX_DEPOSIT_AMOUNT,
    withdrawalFeePercentage: env.WITHDRAWAL_FEE_PERCENTAGE,
    exchangeRateCacheTtlMs: env.EXCHANGE_RATE_CACHE_TTL_MS,
  } as const;
};

export const getKyc = () => {
  const env = getEnv();
  return {
    provider: env.KYC_PROVIDER,
    apiUrl: env.KYC_API_URL,
    apiKey: env.KYC_API_KEY,
    secretKey: env.KYC_SECRET_KEY,
  } as const;
};

export const getEmail = () => {
  const env = getEnv();
  return {
    resendApiKey: env.RESEND_API_KEY,
    apiKey: env.SENDGRID_API_KEY,
    fromEmail: env.FROM_EMAIL,
    fromName: env.FROM_NAME,
    invoiceFromEmail: env.INVOICE_FROM_EMAIL,
    invoiceFromName: env.INVOICE_FROM_NAME,
  } as const;
};

export const getSms = () => {
  const env = getEnv();
  return {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
  } as const;
};

export const getSecurity = () => {
  const env = getEnv();
  return {
    encryptionKey: env.ENCRYPTION_KEY,
    bcryptRounds: env.BCRYPT_ROUNDS,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    csrfSecret: env.CSRF_SECRET,
    sessionSecret: env.SESSION_SECRET,
    twoFaEncryptionKey: env.TWO_FA_ENCRYPTION_KEY,
  } as const;
};

export const getRateLimit = () => {
  const env = getEnv();
  return {
    whitelistIps: env.RATE_LIMIT_WHITELIST_IPS,
  } as const;
};

export const getLogging = () => {
  const env = getEnv();
  return {
    level: env.LOG_LEVEL,
    sentryDsn: env.SENTRY_DSN,
    sentryRelease: env.SENTRY_RELEASE,
  } as const;
};

export const getFeatures = () => {
  const env = getEnv();
  return {
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
};

export const getUpload = () => {
  const env = getEnv();
  return {
    maxFileSize: env.MAX_FILE_SIZE,
    allowedFileTypes: env.ALLOWED_FILE_TYPES.split(','),
  } as const;
};

export const getCardConfig = () => {
  const env = getEnv();
  return {
    maxActiveCardsPerUser: env.MAX_ACTIVE_CARDS_PER_USER,
    defaultExpiryYears: env.DEFAULT_CARD_EXPIRY_YEARS,
    defaultCurrency: env.DEFAULT_CURRENCY,
    requireCompleteProfile: env.REQUIRE_COMPLETE_PROFILE,
  } as const;
};

export const getDefaultUserData = () => {
  const env = getEnv();
  return {
    firstName: env.DEFAULT_USER_FIRST_NAME,
    lastName: env.DEFAULT_USER_LAST_NAME,
    address: env.DEFAULT_USER_ADDRESS,
    city: env.DEFAULT_USER_CITY,
    state: env.DEFAULT_USER_STATE,
    zip: env.DEFAULT_USER_ZIP,
    country: env.DEFAULT_USER_COUNTRY,
    phone: env.DEFAULT_USER_PHONE,
  } as const;
};

export const getTestConfig = () => {
  const env = getEnv();
  return {
    cardIdStart: env.TEST_CARD_ID_START,
    transactionIdStart: env.TEST_TRANSACTION_ID_START,
    binMastercard: env.TEST_BIN_MASTERCARD,
    binVisa: env.TEST_BIN_VISA,
  } as const;
};

// For backward compatibility, export the env object
// This will be deprecated in favor of getEnv()
export const env = new Proxy({} as ValidatedEnv, {
  get(_target, prop) {
    if (!validatedEnv) {
      throw new Error('Environment not initialized. Call initializeConfig() first.');
    }
    return validatedEnv[prop as keyof ValidatedEnv];
  },
});

// Export type for use in other modules
export type Env = ValidatedEnv;

// Backward compatibility exports
export const database = new Proxy({} as ReturnType<typeof getDatabase>, {
  get() {
    return getDatabase();
  },
});

export const redis = new Proxy({} as ReturnType<typeof getRedis>, {
  get() {
    return getRedis();
  },
});

export const jwt = new Proxy({} as ReturnType<typeof getJwt>, {
  get() {
    return getJwt();
  },
});

export const admediacards = new Proxy({} as ReturnType<typeof getAdmediacards>, {
  get() {
    return getAdmediacards();
  },
});

export const xmoney = new Proxy({} as ReturnType<typeof getXmoney>, {
  get() {
    return getXmoney();
  },
});

export const crypto = new Proxy({} as ReturnType<typeof getCrypto>, {
  get() {
    return getCrypto();
  },
});

export const kyc = new Proxy({} as ReturnType<typeof getKyc>, {
  get() {
    return getKyc();
  },
});

export const email = new Proxy({} as ReturnType<typeof getEmail>, {
  get() {
    return getEmail();
  },
});

export const sms = new Proxy({} as ReturnType<typeof getSms>, {
  get() {
    return getSms();
  },
});

export const security = new Proxy({} as ReturnType<typeof getSecurity>, {
  get() {
    return getSecurity();
  },
});

export const rateLimit = new Proxy({} as ReturnType<typeof getRateLimit>, {
  get() {
    return getRateLimit();
  },
});

export const logging = new Proxy({} as ReturnType<typeof getLogging>, {
  get() {
    return getLogging();
  },
});

export const features = new Proxy({} as ReturnType<typeof getFeatures>, {
  get() {
    return getFeatures();
  },
});

export const upload = new Proxy({} as ReturnType<typeof getUpload>, {
  get() {
    return getUpload();
  },
});

export const cardConfig = new Proxy({} as ReturnType<typeof getCardConfig>, {
  get() {
    return getCardConfig();
  },
});

export const defaultUserData = new Proxy({} as ReturnType<typeof getDefaultUserData>, {
  get() {
    return getDefaultUserData();
  },
});

export const testConfig = new Proxy({} as ReturnType<typeof getTestConfig>, {
  get() {
    return getTestConfig();
  },
});