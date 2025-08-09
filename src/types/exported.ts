/**
 * Exported Types for Dashboard Repository
 * 
 * This file contains all TypeScript types that are shared between the backend
 * and dashboard repositories. These types are automatically inferred from our
 * Zod validation schemas to ensure consistency.
 * 
 * Dashboard team can copy this file or import specific types as needed.
 * 
 * Future improvement: Consider creating a shared npm package for these types.
 */

// Re-export all validator types
export {
  // Auth types
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  ResendVerificationInput
} from '../api/validators/authValidators';

export {
  // User types
  UpdateProfileInput,
  UpdateSettingsInput,
  BalanceHistoryQuery
} from '../api/validators/userValidators';

export {
  // Card types
  CreateCardInput,
  UpdateCardLimitsInput,
  CardIdParam,
  CardTransactionsQuery,
  CreateCardSessionInput,
  GetSecureCardDetailsInput
} from '../api/validators/cardValidators';

export {
  // Transaction types
  TransactionType,
  TransactionStatus,
  TransactionHistoryQuery,
  TransactionDetailsParams,
  CardTransactionsParams,
  DisputeTransactionInput,
  ExportTransactionsQuery,
  CreateMockTransactionInput
} from '../api/validators/transactionValidators';

export {
  // Crypto types
  CreateDepositOrderInput,
  CreateWithdrawalInput,
  GetDepositHistoryQuery,
  GetExchangeRatesQuery,
  WebhookPayload
} from '../api/validators/cryptoValidators';

export {
  // Announcement types
  AnnouncementCategory,
  AnnouncementPriority,
  TargetAudience,
  GetAnnouncementsQuery,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementIdParams,
  GetAdminAnnouncementsQuery
} from '../api/validators/announcementValidators';

export {
  // Tier types
  CalculateFeesInput,
  FeeAction
} from '../api/validators/tierValidators';

// Re-export API response types
export {
  ApiResponse,
  PaginatedResponse,
  SuccessResponse,
  ErrorResponse,
  LoginResponse,
  RefreshTokenResponse,
  UserProfileResponse,
  CardResponse,
  CardListResponse,
  TransactionResponse,
  TransactionListResponse,
  CryptoOrderResponse,
  CryptoOrderListResponse
} from '../api/types/responses';

// Common enums and constants
export const USER_ROLES = ['user', 'admin', 'super_admin'] as const;
export type UserRole = typeof USER_ROLES[number];

export const KYC_STATUS = ['not_started', 'pending', 'approved', 'rejected'] as const;
export type KycStatus = typeof KYC_STATUS[number];

export const ACCOUNT_STATUS = ['active', 'suspended', 'deleted'] as const;
export type AccountStatus = typeof ACCOUNT_STATUS[number];

export const CARD_STATUS = ['active', 'frozen', 'expired', 'deleted'] as const;
export type CardStatus = typeof CARD_STATUS[number];

export const CARD_TYPE = ['single_use', 'multi_use'] as const;
export type CardType = typeof CARD_TYPE[number];

export const SUPPORTED_CURRENCIES = ['USD'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export const TIER_LEVELS = [0, 1, 2, 3] as const;
export type TierLevel = typeof TIER_LEVELS[number];