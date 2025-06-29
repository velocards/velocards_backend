import { UserRepository, UpdateUserData, User } from '../repositories/userRepository';
import { PasswordService } from './passwordService';
import { TokenService } from './tokenService';
import { AuthenticationError, ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { RegisterInput, LoginInput } from '../api/validators/authValidators';
import { UserRole, getDefaultRole } from '../config/roles';
import logger from '../utils/logger';

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

    static async getUserProfile(userId: string): Promise<UserPublicData> {
      return this.getProfile(userId);
    }

    static async updateUserProfile(
      userId: string, 
      data: any
    ): Promise<UserPublicData> {
      const updateData: UpdateUserData = {};

      // Handle basic fields
      if (data.firstName || data.lastName) {
        const metadataUpdate: any = {};
        if (data.firstName) metadataUpdate.first_name = data.firstName;
        if (data.lastName) metadataUpdate.last_name = data.lastName;
        updateData.metadata = metadataUpdate;
      }

      if (data.phoneNumber !== undefined) updateData.phone = data.phoneNumber;

      // Handle address if provided
      if (data.address) {
        const currentUser = await UserRepository.findById(userId);
        if (!currentUser) throw new NotFoundError('User not found');
        
        updateData.metadata = {
          ...updateData.metadata,
          address: data.address
        };
      }

      if (data.dateOfBirth) {
        updateData.metadata = {
          ...updateData.metadata,
          date_of_birth: data.dateOfBirth
        };
      }

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
        createdAt: user.created_at
      };
    }
  }