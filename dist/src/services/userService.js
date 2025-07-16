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
const database_1 = require("../config/database");
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
        // Check if email is verified
        if (!user.email_verified) {
            // Record login attempt with unverified email
            await userRepository_1.UserRepository.recordAuthEvent(user.id, 'login_blocked_unverified_email', undefined, // IP address would come from request
            undefined // User agent would come from request
            );
            throw new errors_1.AuthenticationError('Please verify your email before logging in');
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
    /**
     * Get comprehensive user statistics
     */
    static async getUserStatistics(userId) {
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user) {
            throw new errors_1.NotFoundError('User');
        }
        const currentYear = new Date().getFullYear();
        // Run all queries in parallel for performance
        const [lifetimeDeposits, yearlyDeposits, lifetimeCardSpending, yearlyCardSpending, lifetimeFees, yearlyFees, activeCardsCount, tierInfo] = await Promise.all([
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
    static async getDepositStatistics(userId, year) {
        let query = database_1.supabase
            .from('crypto_transactions')
            .select('fiat_amount, status, created_at')
            .eq('user_id', userId)
            .eq('type', 'deposit')
            .in('status', ['completed', 'pending']);
        const { data: deposits, error } = await query;
        if (error) {
            logger_1.default.error('Failed to fetch deposit statistics', { error, userId });
            return { total: 0, pending: 0 };
        }
        // Filter by year if specified
        const filteredDeposits = year && deposits ?
            deposits.filter((d) => new Date(d.created_at).getFullYear() === year) :
            deposits;
        const total = filteredDeposits
            ?.filter((d) => d.status === 'completed')
            .reduce((sum, d) => sum + parseFloat(d.fiat_amount || '0'), 0) || 0;
        const pending = filteredDeposits
            ?.filter((d) => d.status === 'pending')
            .reduce((sum, d) => sum + parseFloat(d.fiat_amount || '0'), 0) || 0;
        return { total, pending };
    }
    static async getCardSpendingStatistics(userId, year) {
        let query = database_1.supabase
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
            logger_1.default.error('Failed to fetch card spending statistics', { error, userId });
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
        transactions?.forEach((tx) => {
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
        const successCount = transactions?.filter((tx) => tx.status === 'completed').length || 0;
        const successRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;
        return {
            ...stats,
            netSpending,
            successRate: Math.round(successRate * 100) / 100
        };
    }
    static async getFeeStatistics(userId, year) {
        // Get card creation fees
        let cardQuery = database_1.supabase
            .from('virtual_cards')
            .select('creation_fee_amount')
            .eq('user_id', userId);
        if (year) {
            const startDate = new Date(year, 0, 1).toISOString();
            const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();
            cardQuery = cardQuery.gte('created_at', startDate).lte('created_at', endDate);
        }
        const { data: cards } = await cardQuery;
        const cardCreationFees = cards?.reduce((sum, card) => sum + parseFloat(card.creation_fee_amount || '0'), 0) || 0;
        // Get monthly fees
        let monthlyQuery = database_1.supabase
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
        const cardMonthlyFees = monthlyFees?.reduce((sum, fee) => sum + parseFloat(fee.fee_amount || '0'), 0) || 0;
        // Get deposit fees from balance ledger
        let depositFeeQuery = database_1.supabase
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
        const depositFeesTotal = depositFees?.reduce((sum, fee) => sum + Math.abs(parseFloat(fee.amount || '0')), 0) || 0;
        return {
            cardCreation: cardCreationFees,
            cardMonthly: cardMonthlyFees,
            deposit: depositFeesTotal
        };
    }
    static async getActiveCardsCount(userId) {
        const { count, error } = await database_1.supabase
            .from('virtual_cards')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'active');
        if (error) {
            logger_1.default.error('Failed to get active cards count', { error, userId });
            return 0;
        }
        return count || 0;
    }
    static async getTierInfo(userId) {
        const user = await userRepository_1.UserRepository.findById(userId);
        if (!user?.tier) {
            return { name: 'Unverified', level: 0 };
        }
        return {
            name: user.tier.display_name || user.tier.name,
            level: user.tier.tier_level
        };
    }
}
exports.UserService = UserService;
//# sourceMappingURL=userService.js.map