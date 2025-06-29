"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const userRepository_1 = require("../repositories/userRepository");
const cardRepository_1 = require("../repositories/cardRepository");
const cryptoRepository_1 = require("../repositories/cryptoRepository");
const passwordService_1 = require("./passwordService");
const tokenService_1 = require("./tokenService");
const tierService_1 = __importDefault(require("./tierService"));
const errors_1 = require("../utils/errors");
const roles_1 = require("../config/roles");
const logger_1 = __importDefault(require("../utils/logger"));
class UserService {
    static async register(data) {
        // Check if email is available
        const emailAvailable = await userRepository_1.UserRepository.isEmailAvailable(data.email);
        if (!emailAvailable) {
            throw new errors_1.ConflictError('Email is already registered');
        }
        // Validate password
        passwordService_1.PasswordService.validatePassword(data.password);
        // Hash password
        const passwordHash = await passwordService_1.PasswordService.hash(data.password);
        // Create user with default role
        const defaultRole = (0, roles_1.getDefaultRole)();
        const user = await userRepository_1.UserRepository.create({
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
        const tokens = await tokenService_1.TokenService.generateTokenPair(user.id, user.email, user.role);
        // Record registration event
        await userRepository_1.UserRepository.recordAuthEvent(user.id, 'user_registered', undefined, // IP address would come from request
        undefined // User agent would come from request
        );
        logger_1.default.info(`New user registered: ${user.email}`);
        return {
            user: this.formatUserResponse(user),
            tokens
        };
    }
    static async login(data) {
        // Find user by email
        const user = await userRepository_1.UserRepository.findByEmail(data.email);
        if (!user) {
            throw new errors_1.AuthenticationError('Invalid email or password');
        }
        // Check account status
        if (user.account_status !== 'active') {
            throw new errors_1.AuthenticationError(`Account is ${user.account_status}`);
        }
        // Get password hash from user_auth table
        const passwordHash = await userRepository_1.UserRepository.getPasswordHash(user.id);
        if (!passwordHash) {
            throw new errors_1.AuthenticationError('Invalid email or password');
        }
        const passwordValid = await passwordService_1.PasswordService.verify(data.password, passwordHash);
        if (!passwordValid) {
            // Record failed login attempt
            await userRepository_1.UserRepository.recordAuthEvent(user.id, 'login_failed', undefined, // IP address would come from request
            undefined // User agent would come from request
            );
            throw new errors_1.AuthenticationError('Invalid email or password');
        }
        // Record successful login
        await userRepository_1.UserRepository.recordAuthEvent(user.id, 'login_success', undefined, // IP address would come from request
        undefined // User agent would come from request
        );
        // Generate tokens with role
        const tokens = await tokenService_1.TokenService.generateTokenPair(user.id, user.email, user.role);
        logger_1.default.info(`User logged in: ${user.email}`);
        return {
            user: this.formatUserResponse(user),
            tokens
        };
    }
    static async getProfile(userId) {
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user) {
            throw new errors_1.NotFoundError('User');
        }
        return this.formatUserResponse(user);
    }
    static async updateProfile(userId, data) {
        const updateData = {};
        // Build metadata update if name fields are provided
        const metadataUpdate = {};
        if (data.firstName !== undefined)
            metadataUpdate.first_name = data.firstName;
        if (data.lastName !== undefined)
            metadataUpdate.last_name = data.lastName;
        if (Object.keys(metadataUpdate).length > 0) {
            updateData.metadata = metadataUpdate;
        }
        if (data.phone !== undefined)
            updateData.phone = data.phone;
        const user = await userRepository_1.UserRepository.update(userId, updateData);
        logger_1.default.info(`User profile updated: ${user.email}`);
        return this.formatUserResponse(user);
    }
    static async getBalance(userId) {
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user) {
            throw new errors_1.NotFoundError('User');
        }
        return {
            balance: user.virtual_balance,
            totalSpent: user.total_spent
        };
    }
    static async addBalance(userId, amount) {
        if (amount <= 0) {
            throw new errors_1.ValidationError('Amount must be positive');
        }
        await userRepository_1.UserRepository.adjustBalance(userId, amount, 'add');
        logger_1.default.info(`Added ${amount} to user ${userId} balance`);
    }
    static async deductBalance(userId, amount) {
        if (amount <= 0) {
            throw new errors_1.ValidationError('Amount must be positive');
        }
        await userRepository_1.UserRepository.adjustBalance(userId, amount, 'subtract');
        logger_1.default.info(`Deducted ${amount} from user ${userId} balance`);
    }
    static async verifyEmail(userId) {
        await userRepository_1.UserRepository.verifyEmail(userId);
        logger_1.default.info(`Email verified for user ${userId}`);
    }
    static async getUserProfile(userId) {
        return this.getProfile(userId);
    }
    static async updateUserProfile(userId, data) {
        const updateData = {};
        // Handle basic fields
        if (data.firstName || data.lastName) {
            const metadataUpdate = {};
            if (data.firstName)
                metadataUpdate.first_name = data.firstName;
            if (data.lastName)
                metadataUpdate.last_name = data.lastName;
            updateData.metadata = metadataUpdate;
        }
        if (data.phoneNumber !== undefined)
            updateData.phone = data.phoneNumber;
        // Handle address if provided
        if (data.address) {
            const currentUser = await userRepository_1.UserRepository.findById(userId);
            if (!currentUser)
                throw new errors_1.NotFoundError('User not found');
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
        const user = await userRepository_1.UserRepository.update(userId, updateData);
        logger_1.default.info(`User profile updated: ${user.email}`);
        return this.formatUserResponse(user);
    }
    static async getUserBalance(userId) {
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        return user;
    }
    static async getUserAvailableBalance(userId) {
        // Get user's account balance and tier info
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
        }
        // Get user's tier information for fees
        const tierInfo = await tierService_1.default.getUserTierInfo(userId);
        if (!tierInfo) {
            throw new errors_1.AppError('USER_TIER_ERROR', 'User tier information not found', 500);
        }
        // Get total balance locked in active cards (for display purposes only)
        const activeCardsBalance = await cardRepository_1.CardRepository.getUserTotalCardBalance(userId);
        // Calculate available balance
        // The user's virtual_balance already has card funding deducted when cards are created/updated
        // So available balance is simply the current account balance
        const availableBalance = Math.max(0, user.virtual_balance);
        // Get pending deposits (orders that haven't been completed yet)
        const pendingDeposits = await cryptoRepository_1.CryptoRepository.getUserPendingDepositsTotal(userId);
        logger_1.default.info('Calculated available balance', {
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
    static async getBalanceHistory(userId, params) {
        // TODO: This will be implemented when we have the balance_ledger repository
        // For now, return mock data
        logger_1.default.info('Balance history requested', { userId, params });
        return {
            transactions: [],
            page: params.page,
            limit: params.limit,
            total: 0,
            totalPages: 0
        };
    }
    static async updateUserSettings(userId, settings) {
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user) {
            throw new errors_1.NotFoundError('User not found');
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
        await userRepository_1.UserRepository.update(userId, {
            metadata: {
                ...user.metadata,
                settings: updatedSettings
            }
        });
        logger_1.default.info(`User settings updated: ${user.email}`);
        return updatedSettings;
    }
    static formatUserResponse(user) {
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
            role: user.role || roles_1.UserRole.USER,
            createdAt: user.created_at,
            tier: user.tier ? {
                id: user.tier.id,
                level: user.tier.tier_level,
                name: user.tier.name,
                displayName: user.tier.display_name,
                ...(user.tier.description !== undefined && { description: user.tier.description }),
                ...(user.tier.features !== undefined && { features: user.tier.features })
            } : null,
            ...(user.tier_assigned_at !== undefined && { tierAssignedAt: user.tier_assigned_at })
        };
    }
}
exports.UserService = UserService;
//# sourceMappingURL=userService.js.map