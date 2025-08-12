/**
 * Feature flags for controlled rollout of new features
 * Set these via environment variables or configuration
 */

export const featureFlags = {
  // Repository migration flags
  USE_NEW_AUDIT_LOG_REPO: process.env['USE_NEW_AUDIT_LOG_REPO'] === 'true' || false,
  USE_NEW_SECURITY_KEY_REPO: process.env['USE_NEW_SECURITY_KEY_REPO'] === 'true' || false,
  USE_NEW_CRYPTO_PRICE_REPO: process.env['USE_NEW_CRYPTO_PRICE_REPO'] === 'true' || false,
  USE_NEW_CRYPTO_TRANSACTION_REPO: process.env['USE_NEW_CRYPTO_TRANSACTION_REPO'] === 'true' || false,
  USE_NEW_USER_BALANCE_LEDGER_REPO: process.env['USE_NEW_USER_BALANCE_LEDGER_REPO'] === 'true' || false,
  
  // Global switch for all new repositories
  USE_NEW_REPOSITORIES: process.env['USE_NEW_REPOSITORIES'] === 'true' || false,
}

// Helper to check if a repository should use the new implementation
export function shouldUseNewRepository(repoName: string): boolean {
  // Global override
  if (featureFlags.USE_NEW_REPOSITORIES) {
    return true
  }
  
  // Check specific repository flags
  switch (repoName) {
    case 'AuditLog':
      return featureFlags.USE_NEW_AUDIT_LOG_REPO
    case 'SecurityKey':
      return featureFlags.USE_NEW_SECURITY_KEY_REPO
    case 'CryptoPrice':
      return featureFlags.USE_NEW_CRYPTO_PRICE_REPO
    case 'CryptoTransaction':
      return featureFlags.USE_NEW_CRYPTO_TRANSACTION_REPO
    case 'UserBalanceLedger':
      return featureFlags.USE_NEW_USER_BALANCE_LEDGER_REPO
    default:
      return false
  }
}