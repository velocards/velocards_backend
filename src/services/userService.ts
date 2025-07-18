import { UserRepository, UpdateUserData, User } from '../repositories/userRepository';
import { CardRepository } from '../repositories/cardRepository';
import { CryptoRepository } from '../repositories/cryptoRepository';
import { PasswordService } from './passwordService';
import { TokenService } from './tokenService';
import tierService from './tierService';
import { AuthenticationError, ConflictError, NotFoundError, ValidationError, AppError } from '../utils/errors';
import { RegisterInput, LoginInput } from '../api/validators/authValidators';
import { UserRole, getDefaultRole } from '../config/roles';
import logger from '../utils/logger';
import { supabase } from '../config/database';

export interface BalanceHistoryParams {
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
  type: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface BalanceHistoryResult {
  transactions: any[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserSettings {
  notifications?: {
    email?: {
      transactions?: boolean;
      security?: boolean;
      marketing?: boolean;
      updates?: boolean;
    };
    sms?: {
      transactions?: boolean;
      security?: boolean;
    };
    push?: {
      transactions?: boolean;
      security?: boolean;
      updates?: boolean;
    };
  };
  security?: {
    twoFactorEnabled?: boolean;
    loginAlerts?: boolean;
    transactionAlerts?: boolean;
    ipWhitelisting?: boolean;
    allowedIps?: string[];
  };
  preferences?: {
    language?: string;
    currency?: string;
    timezone?: string;
    dateFormat?: string;
    theme?: string;
  };
}

export interface UserPublicData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null | undefined;
  emailVerified: boolean;
  kycStatus: string;
  accountStatus: string;
  virtualBalance: number;
  role: UserRole;
  createdAt: Date;
  tier?: {
    id: string;
    level: number;
    name: string;
    displayName: string;
    description?: string;
    features?: any;
  } | null;
  tierAssignedAt?: Date | null;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  } | null;
  dateOfBirth?: string | null;
}

export class UserService {
    static async register(data: RegisterInput) {
      // Check if email is available
      const emailAvailable = await UserRepository.isEmailAvailable(data.email);
      if (!emailAvailable) {
        throw new ConflictError('Email is already registered');
      }

      // Validate password
      PasswordService.validatePassword(data.password);

      // Hash password
      const passwordHash = await PasswordService.hash(data.password);

      // Create user with default role
      const defaultRole = getDefaultRole();
      const user = await UserRepository.create({
        email: data.email,
        password_hash: passwordHash,
        phone: data.phone || null,
        role: defaultRole,
        metadata: {
          first_name: data.firstName,
          last_name: data.lastName
        }
      });

      // Generate tokens with role
      const tokens = await TokenService.generateTokenPair(user.id, user.email, user.role as UserRole);

      // Record registration event
      await UserRepository.recordAuthEvent(
        user.id,
        'user_registered',
        undefined, // IP address would come from request
        undefined  // User agent would come from request
      );

      logger.info(`New user registered: ${user.email}`);

      return {
        user: this.formatUserResponse(user),
        tokens
      };
    }

    static async login(data: LoginInput) {
      // Find user by email
      const user = await UserRepository.findByEmail(data.email);
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Check account status
      if (user.account_status !== 'active') {
        throw new AuthenticationError(`Account is ${user.account_status}`);
      }

      // Get password hash from user_auth table
      const passwordHash = await UserRepository.getPasswordHash(user.id);
      if (!passwordHash) {
        throw new AuthenticationError('Invalid email or password');
      }
      
      const passwordValid = await PasswordService.verify(data.password, passwordHash);
      if (!passwordValid) {
        // Record failed login attempt
        await UserRepository.recordAuthEvent(
          user.id,
          'login_failed',
          undefined, // IP address would come from request
          undefined  // User agent would come from request
        );
        throw new AuthenticationError('Invalid email or password');
      }

      // Check if email is verified
      if (!user.email_verified) {
        // Record login attempt with unverified email
        await UserRepository.recordAuthEvent(
          user.id,
          'login_blocked_unverified_email',
          undefined, // IP address would come from request
          undefined  // User agent would come from request
        );
        throw new AuthenticationError('Please verify your email before logging in');
      }

      // Record successful login
      await UserRepository.recordAuthEvent(
        user.id,
        'login_success',
        undefined, // IP address would come from request
        undefined  // User agent would come from request
      );

      // Generate tokens with role
      const tokens = await TokenService.generateTokenPair(user.id, user.email, user.role as UserRole);

      logger.info(`User logged in: ${user.email}`);

      return {
        user: this.formatUserResponse(user),
        tokens
      };
    }

    static async getProfile(userId: string): Promise<UserPublicData> {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      return this.formatUserResponse(user);
    }

    static async updateProfile(
      userId: string,
      data: { firstName?: string; lastName?: string; phone?: string | null }
    ): Promise<UserPublicData> {
      const updateData: UpdateUserData = {};

      // Build metadata update if name fields are provided
      const metadataUpdate: any = {};
      if (data.firstName !== undefined) metadataUpdate.first_name = data.firstName;
      if (data.lastName !== undefined) metadataUpdate.last_name = data.lastName;
      
      if (Object.keys(metadataUpdate).length > 0) {
        updateData.metadata = metadataUpdate;
      }

      if (data.phone !== undefined) updateData.phone = data.phone;

      const user = await UserRepository.update(userId, updateData);

      logger.info(`User profile updated: ${user.email}`);

      return this.formatUserResponse(user);
    }

    static async getBalance(userId: string): Promise<{ balance: number; totalSpent: number }> {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      return {
        balance: user.virtual_balance,
        totalSpent: user.total_spent
      };
    }

    static async addBalance(userId: string, amount: number): Promise<void> {
      if (amount <= 0) {
        throw new ValidationError('Amount must be positive');
      }

      await UserRepository.adjustBalance(userId, amount, 'add');
      logger.info(`Added ${amount} to user ${userId} balance`);
    }

    static async deductBalance(userId: string, amount: number): Promise<void> {
      if (amount <= 0) {
        throw new ValidationError('Amount must be positive');
      }

      await UserRepository.adjustBalance(userId, amount, 'subtract');
      logger.info(`Deducted ${amount} from user ${userId} balance`);
    }

    static async verifyEmail(userId: string): Promise<void> {
      await UserRepository.verifyEmail(userId);
      logger.info(`Email verified for user ${userId}`);
    }

    static async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
      // Get current password hash
      const passwordHash = await UserRepository.getPasswordHash(userId);
      if (!passwordHash) {
        throw new AuthenticationError('User password not found');
      }

      // Verify old password
      const isValidPassword = await PasswordService.verify(oldPassword, passwordHash);
      if (!isValidPassword) {
        // Record failed password change attempt
        await UserRepository.recordAuthEvent(
          userId,
          'password_change_failed',
          undefined,
          undefined,
          { reason: 'invalid_old_password' }
        );
        throw new AuthenticationError('Current password is incorrect');
      }

      // Validate new password
      PasswordService.validatePassword(newPassword);

      // Check if new password is different from old password
      const isSamePassword = await PasswordService.verify(newPassword, passwordHash);
      if (isSamePassword) {
        throw new ValidationError('New password must be different from current password');
      }

      // Hash new password
      const newPasswordHash = await PasswordService.hash(newPassword);

      // Update password
      await UserRepository.updatePasswordHash(userId, newPasswordHash);

      // Record successful password change
      await UserRepository.recordAuthEvent(
        userId,
        'password_changed',
        undefined,
        undefined
      );

      logger.info(`Password changed for user ${userId}`);
    }

    static async getUserProfile(userId: string): Promise<UserPublicData> {
      return this.getProfile(userId);
    }

    static async updateUserProfile(
      userId: string, 
      data: any
    ): Promise<UserPublicData> {
      // First, get the current user to preserve existing metadata
      const currentUser = await UserRepository.findById(userId);
      if (!currentUser) throw new NotFoundError('User not found');

      const updateData: UpdateUserData = {};
      
      // Start with existing metadata to preserve all fields
      const metadataUpdate: any = { ...(currentUser.metadata || {}) };

      // Handle basic fields
      if (data.firstName !== undefined) metadataUpdate.first_name = data.firstName;
      if (data.lastName !== undefined) metadataUpdate.last_name = data.lastName;

      // Handle address if provided
      if (data.address) {
        metadataUpdate.address = data.address;
      }

      // Handle date of birth if provided
      if (data.dateOfBirth) {
        metadataUpdate.date_of_birth = data.dateOfBirth;
      }

      // Only update metadata if there are changes
      if (Object.keys(metadataUpdate).length > 0) {
        updateData.metadata = metadataUpdate;
      }

      // Handle phone number
      if (data.phoneNumber !== undefined) updateData.phone = data.phoneNumber;

      const user = await UserRepository.update(userId, updateData);
      logger.info(`User profile updated: ${user.email}`);

      return this.formatUserResponse(user);
    }

    static async getUserBalance(userId: string): Promise<User> {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }
      return user;
    }

    static async getUserAvailableBalance(userId: string): Promise<{
      accountBalance: number;
      activeCardsBalance: number;
      availableBalance: number;
      pendingDeposits: number;
      tierInfo: {
        level: number;
        name: string;
        cardCreationFee: number;
        depositFeePercentage: number;
      };
    }> {
      // Get user's account balance and tier info
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Get user's tier information for fees
      const tierInfo = await tierService.getUserTierInfo(userId);
      if (!tierInfo) {
        throw new AppError('USER_TIER_ERROR', 'User tier information not found', 500);
      }

      // Get total balance locked in active cards (for display purposes only)
      const activeCardsBalance = await CardRepository.getUserTotalCardBalance(userId);

      // Calculate available balance
      // The user's virtual_balance already has card funding deducted when cards are created/updated
      // So available balance is simply the current account balance
      const availableBalance = Math.max(0, user.virtual_balance);

      // Get pending deposits (orders that haven't been completed yet)
      const pendingDeposits = await CryptoRepository.getUserPendingDepositsTotal(userId);

      logger.info('Calculated available balance', {
        userId,
        accountBalance: user.virtual_balance,
        activeCardsBalance,
        availableBalance,
        pendingDeposits,
        tierLevel: tierInfo.tier_level
      });

      return {
        accountBalance: user.virtual_balance,
        activeCardsBalance,
        availableBalance,
        pendingDeposits,
        tierInfo: {
          level: tierInfo.tier_level,
          name: tierInfo.tier_name,
          cardCreationFee: tierInfo.card_creation_fee || 0,
          depositFeePercentage: tierInfo.deposit_fee_percentage || 0
        }
      };
    }

    static async getBalanceHistory(
      userId: string, 
      params: BalanceHistoryParams
    ): Promise<BalanceHistoryResult> {
      // TODO: This will be implemented when we have the balance_ledger repository
      // For now, return mock data
      logger.info('Balance history requested', { userId, params });
      
      return {
        transactions: [],
        page: params.page,
        limit: params.limit,
        total: 0,
        totalPages: 0
      };
    }

    static async updateUserSettings(
      userId: string, 
      settings: UserSettings
    ): Promise<UserSettings> {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Merge new settings with existing ones
      const currentSettings = user.metadata?.['settings'] || {};
      const updatedSettings = {
        notifications: {
          ...(currentSettings.notifications || {}),
          ...(settings.notifications || {})
        },
        security: {
          ...(currentSettings.security || {}),
          ...(settings.security || {})
        },
        preferences: {
          ...(currentSettings.preferences || {}),
          ...(settings.preferences || {})
        }
      };

      await UserRepository.update(userId, {
        metadata: {
          ...user.metadata,
          settings: updatedSettings
        }
      });

      logger.info(`User settings updated: ${user.email}`);
      return updatedSettings;
    }

    private static formatUserResponse(user: User): UserPublicData {
      return {
        id: user.id,
        email: user.email,
        firstName: user.metadata?.first_name || '',
        lastName: user.metadata?.last_name || '',
        phone: user.phone,
        emailVerified: user.email_verified,
        kycStatus: user.kyc_status,
        accountStatus: user.account_status,
        virtualBalance: user.virtual_balance,
        role: (user.role as UserRole) || UserRole.USER,
        createdAt: user.created_at,
        tier: user.tier ? {
          id: user.tier.id,
          level: user.tier.tier_level,
          name: user.tier.name,
          displayName: user.tier.display_name,
          ...(user.tier.description !== undefined && { description: user.tier.description }),
          ...(user.tier.features !== undefined && { features: user.tier.features })
        } : null,
        ...(user.tier_assigned_at !== undefined && { tierAssignedAt: user.tier_assigned_at }),
        address: user.metadata?.['address'] || null,
        dateOfBirth: user.metadata?.['date_of_birth'] || null
      };
    }

    /**
     * Get comprehensive user statistics
     */
    static async getUserStatistics(userId: string): Promise<any> {
      const user = await UserRepository.findById(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      const currentYear = new Date().getFullYear();

      // Run all queries in parallel for performance
      const [
        lifetimeDeposits,
        yearlyDeposits,
        lifetimeCardSpending,
        yearlyCardSpending,
        lifetimeFees,
        yearlyFees,
        activeCardsCount,
        tierInfo
      ] = await Promise.all([
        // Lifetime deposit statistics
        this.getDepositStatistics(userId),
        // Yearly deposit statistics
        this.getDepositStatistics(userId, currentYear),
        // Lifetime card spending statistics
        this.getCardSpendingStatistics(userId),
        // Yearly card spending statistics
        this.getCardSpendingStatistics(userId, currentYear),
        // Lifetime fees
        this.getFeeStatistics(userId),
        // Yearly fees
        this.getFeeStatistics(userId, currentYear),
        // Active cards count
        this.getActiveCardsCount(userId),
        // Tier information
        this.getTierInfo(userId)
      ]);

      // Calculate totals
      const lifetimeTotalFees = lifetimeFees.cardCreation + lifetimeFees.cardMonthly + lifetimeFees.deposit;
      const yearlyTotalFees = yearlyFees.cardCreation + yearlyFees.cardMonthly + yearlyFees.deposit;
      const yearlyTotalSpending = yearlyCardSpending.completed + yearlyTotalFees;

      return {
        lifetime: {
          deposits: lifetimeDeposits,
          cardSpending: lifetimeCardSpending,
          fees: {
            ...lifetimeFees,
            total: lifetimeTotalFees
          }
        },
        currentYear: {
          year: currentYear,
          deposits: yearlyDeposits,
          cardSpending: yearlyCardSpending,
          fees: {
            ...yearlyFees,
            total: yearlyTotalFees
          },
          totalSpending: yearlyTotalSpending
        },
        accountInfo: {
          activeCardsCount,
          currentTier: tierInfo.name,
          tierLevel: tierInfo.level
        }
      };
    }

    private static async getDepositStatistics(userId: string, year?: number): Promise<{
      total: number;
      pending: number;
    }> {
      let query = supabase
        .from('crypto_transactions')
        .select('fiat_amount, status, created_at')
        .eq('user_id', userId)
        .eq('type', 'deposit')
        .in('status', ['completed', 'pending']);

      const { data: deposits, error } = await query;

      if (error) {
        logger.error('Failed to fetch deposit statistics', { error, userId });
        return { total: 0, pending: 0 };
      }

      // Filter by year if specified
      const filteredDeposits = year && deposits ? 
        deposits.filter((d: any) => new Date(d.created_at).getFullYear() === year) : 
        deposits;

      const total = filteredDeposits
        ?.filter((d: any) => d.status === 'completed')
        .reduce((sum: number, d: any) => sum + parseFloat(d.fiat_amount || '0'), 0) || 0;

      const pending = filteredDeposits
        ?.filter((d: any) => d.status === 'pending')
        .reduce((sum: number, d: any) => sum + parseFloat(d.fiat_amount || '0'), 0) || 0;

      return { total, pending };
    }

    private static async getCardSpendingStatistics(userId: string, year?: number): Promise<{
      completed: number;
      pending: number;
      failed: number;
      reversed: number;
      netSpending: number;
      successRate: number;
    }> {
      let query = supabase
        .from('transactions')
        .select('amount, status')
        .eq('user_id', userId);

      if (year) {
        const startDate = new Date(year, 0, 1).toISOString();
        const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data: transactions, error } = await query;

      if (error) {
        logger.error('Failed to fetch card spending statistics', { error, userId });
        return { 
          completed: 0, 
          pending: 0, 
          failed: 0, 
          reversed: 0, 
          netSpending: 0, 
          successRate: 0 
        };
      }

      const stats = {
        completed: 0,
        pending: 0,
        failed: 0,
        reversed: 0
      };

      transactions?.forEach((tx: any) => {
        const amount = parseFloat(tx.amount || '0');
        switch (tx.status) {
          case 'completed':
            stats.completed += amount;
            break;
          case 'pending':
            stats.pending += amount;
            break;
          case 'failed':
            stats.failed += amount;
            break;
          case 'reversed':
            stats.reversed += amount;
            break;
        }
      });

      const netSpending = stats.completed - stats.reversed;
      const totalAttempts = transactions?.length || 0;
      const successCount = transactions?.filter((tx: any) => tx.status === 'completed').length || 0;
      const successRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;

      return {
        ...stats,
        netSpending,
        successRate: Math.round(successRate * 100) / 100
      };
    }

    private static async getFeeStatistics(userId: string, year?: number): Promise<{
      cardCreation: number;
      cardMonthly: number;
      deposit: number;
    }> {
      // Get card creation fees
      let cardQuery = supabase
        .from('virtual_cards')
        .select('creation_fee_amount')
        .eq('user_id', userId);

      if (year) {
        const startDate = new Date(year, 0, 1).toISOString();
        const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
        cardQuery = cardQuery.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data: cards } = await cardQuery;

      const cardCreationFees = cards?.reduce((sum: number, card: any) => 
        sum + parseFloat(card.creation_fee_amount || '0'), 0) || 0;

      // Get monthly fees
      let monthlyQuery = supabase
        .from('card_monthly_fees')
        .select('fee_amount')
        .eq('user_id', userId)
        .eq('status', 'charged');

      if (year) {
        monthlyQuery = monthlyQuery
          .gte('billing_month', `${year}-01-01`)
          .lte('billing_month', `${year}-12-31`);
      }

      const { data: monthlyFees } = await monthlyQuery;

      const cardMonthlyFees = monthlyFees?.reduce((sum: number, fee: any) => 
        sum + parseFloat(fee.fee_amount || '0'), 0) || 0;

      // Get deposit fees from balance ledger
      let depositFeeQuery = supabase
        .from('user_balance_ledger')
        .select('amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'fee')
        .or('reference_type.eq.deposit_fee,reference_type.eq.crypto_deposit_fee');

      if (year) {
        const startDate = new Date(year, 0, 1).toISOString();
        const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
        depositFeeQuery = depositFeeQuery.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data: depositFees } = await depositFeeQuery;

      const depositFeesTotal = depositFees?.reduce((sum: number, fee: any) => 
        sum + Math.abs(parseFloat(fee.amount || '0')), 0) || 0;

      return {
        cardCreation: cardCreationFees,
        cardMonthly: cardMonthlyFees,
        deposit: depositFeesTotal
      };
    }

    private static async getActiveCardsCount(userId: string): Promise<number> {
      const { count, error } = await supabase
        .from('virtual_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) {
        logger.error('Failed to get active cards count', { error, userId });
        return 0;
      }

      return count || 0;
    }

    private static async getTierInfo(userId: string): Promise<{ name: string; level: number }> {
      const user = await UserRepository.findById(userId);
      
      if (!user?.tier) {
        return { name: 'Unverified', level: 0 };
      }

      return {
        name: user.tier.display_name || user.tier.name,
        level: user.tier.tier_level
      };
    }
}

