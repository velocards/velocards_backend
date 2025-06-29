"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database")); // Changed: Added curly braces for named export
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
class UserRepository {
    static supabase = database_1.default;
    static async create(data) {
        try {
            logger_1.default.info('Creating new user:', { email: data.email });
            // First check if user already exists in our profiles
            const existingUser = await this.findByEmail(data.email);
            if (existingUser) {
                throw new errors_1.ConflictError('Email already exists');
            }
            // Generate a UUID for the new user
            const userId = (0, uuid_1.v4)();
            logger_1.default.info('Generated user ID:', userId);
            // Create user profile directly (no more Supabase Auth dependency)
            const { data: user, error } = await database_1.default
                .from('user_profiles')
                .insert({
                id: userId,
                email: data.email.toLowerCase(),
                phone: data.phone || null,
                role: data.role || 'user', // Default to 'user' role if not specified
                email_verified: false, // Will need email verification in future
                kyc_status: 'pending',
                kyc_completed_at: null,
                risk_score: 0,
                account_status: 'active',
                virtual_balance: 0,
                total_spent: 0,
                metadata: {
                    ...data.metadata
                    // password_hash removed from metadata - will go to user_auth table
                }
            })
                .select()
                .single();
            if (error) {
                if (error.code === '23505') { // Unique constraint violation
                    throw new errors_1.ConflictError('Email already exists');
                }
                logger_1.default.error('Error creating user:', error);
                throw new errors_1.InternalError('Failed to create user');
            }
            // Now create the auth record in user_auth table
            logger_1.default.info('Creating auth record for user:', userId);
            const { error: authError } = await database_1.default
                .from('user_auth')
                .insert({
                user_id: userId,
                password_hash: data.password_hash,
                created_at: new Date().toISOString()
            });
            if (authError) {
                // If auth record fails, we should delete the user profile
                logger_1.default.error('Failed to create auth record, rolling back user profile');
                await database_1.default.from('user_profiles').delete().eq('id', userId);
                logger_1.default.error('Error creating auth record:', authError);
                throw new errors_1.InternalError('Failed to create user authentication');
            }
            logger_1.default.info('User created successfully:', { userId, email: user.email });
            return user;
        }
        catch (error) {
            if (error instanceof errors_1.ConflictError)
                throw error;
            logger_1.default.error('Unexpected error in create user:', error);
            throw new errors_1.InternalError('Failed to create user');
        }
    }
    static async findById(id) {
        try {
            const { data: user, error } = await database_1.default
                .from('user_profiles')
                .select(`
            *,
            tier:user_tiers!tier_id (
              id,
              tier_level,
              name,
              display_name,
              description,
              features
            )
          `)
                .eq('id', id)
                .single();
            if (error) {
                if (error.code === 'PGRST116') { // No rows found
                    return null;
                }
                logger_1.default.error('Error finding user by id:', error);
                throw new errors_1.InternalError('Failed to fetch user');
            }
            return user;
        }
        catch (error) {
            if (error instanceof errors_1.InternalError)
                throw error;
            logger_1.default.error('Unexpected error in findById:', error);
            throw new errors_1.InternalError('Failed to fetch user');
        }
    }
    static async findByEmail(email) {
        try {
            const { data: user, error } = await database_1.default
                .from('user_profiles')
                .select(`
            *,
            tier:user_tiers!tier_id (
              id,
              tier_level,
              name,
              display_name,
              description,
              features
            )
          `)
                .eq('email', email.toLowerCase())
                .single();
            if (error) {
                if (error.code === 'PGRST116') { // No rows found
                    return null;
                }
                logger_1.default.error('Error finding user by email:', error);
                throw new errors_1.InternalError('Failed to fetch user');
            }
            logger_1.default.info('User found with tier info:', {
                userId: user?.id,
                email: user?.email,
                hasTier: !!user?.tier,
                tierLevel: user?.tier?.tier_level
            });
            return user;
        }
        catch (error) {
            if (error instanceof errors_1.InternalError)
                throw error;
            logger_1.default.error('Unexpected error in findByEmail:', error);
            throw new errors_1.InternalError('Failed to fetch user');
        }
    }
    static async updateBalance(id, newBalance) {
        try {
            const { data: user, error } = await database_1.default
                .from('user_profiles')
                .update({
                virtual_balance: newBalance,
                updated_at: new Date().toISOString()
            })
                .eq('id', id)
                .select()
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    throw new errors_1.NotFoundError('User');
                }
                logger_1.default.error('Error updating user balance:', error);
                throw new errors_1.InternalError('Failed to update user balance');
            }
            return user;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError || error instanceof errors_1.InternalError)
                throw error;
            logger_1.default.error('Unexpected error in updateBalance:', error);
            throw new errors_1.InternalError('Failed to update user balance');
        }
    }
    static async update(id, data) {
        try {
            // Prepare update data
            const updateData = {
                updated_at: new Date().toISOString()
            };
            // Only add fields that are provided
            if (data.phone !== undefined)
                updateData.phone = data.phone;
            if (data.email_verified !== undefined)
                updateData.email_verified = data.email_verified;
            if (data.kyc_status !== undefined)
                updateData.kyc_status = data.kyc_status;
            if (data.account_status !== undefined)
                updateData.account_status = data.account_status;
            if (data.metadata !== undefined)
                updateData.metadata = data.metadata;
            const { data: user, error } = await database_1.default
                .from('user_profiles')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    throw new errors_1.NotFoundError('User');
                }
                logger_1.default.error('Error updating user:', error);
                throw new errors_1.InternalError('Failed to update user');
            }
            return user;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError)
                throw error;
            if (error instanceof errors_1.InternalError)
                throw error;
            logger_1.default.error('Unexpected error in update user:', error);
            throw new errors_1.InternalError('Failed to update user');
        }
    }
    static async adjustBalance(id, amount, operation) {
        try {
            // First get current balance
            const user = await this.findById(id);
            if (!user) {
                throw new errors_1.NotFoundError('User');
            }
            const newBalance = operation === 'add'
                ? user.virtual_balance + amount
                : user.virtual_balance - amount;
            if (newBalance < 0) {
                throw new errors_1.ConflictError('Insufficient balance');
            }
            const { data: updatedUser, error } = await database_1.default
                .from('user_profiles')
                .update({
                virtual_balance: newBalance,
                total_spent: operation === 'subtract'
                    ? user.total_spent + amount
                    : user.total_spent,
                updated_at: new Date().toISOString()
            })
                .eq('id', id)
                .select()
                .single();
            if (error) {
                logger_1.default.error('Error updating balance:', error);
                throw new errors_1.InternalError('Failed to update balance');
            }
            // Record in balance ledger
            await this.recordBalanceChange(id, amount, operation, user.virtual_balance, newBalance);
            return updatedUser;
        }
        catch (error) {
            if (error instanceof errors_1.NotFoundError || error instanceof errors_1.ConflictError)
                throw error;
            logger_1.default.error('Unexpected error in updateBalance:', error);
            throw new errors_1.InternalError('Failed to update balance');
        }
    }
    static async recordBalanceChange(userId, amount, operation, balanceBefore, balanceAfter) {
        try {
            const { error } = await database_1.default
                .from('user_balance_ledger')
                .insert({
                id: (0, uuid_1.v4)(), // Added: id field is required in schema
                user_id: userId,
                transaction_type: operation === 'add' ? 'deposit' : 'card_funding',
                amount: amount,
                balance_before: balanceBefore,
                balance_after: balanceAfter,
                reference_type: operation === 'add' ? 'manual_deposit' : 'card_creation', // Added: required field
                description: `Balance ${operation} of ${amount}`,
                created_at: new Date().toISOString()
            });
            if (error) {
                logger_1.default.error('Error recording balance change:', error);
                // Don't throw here, this is not critical
            }
        }
        catch (error) {
            logger_1.default.error('Unexpected error in recordBalanceChange:', error);
        }
    }
    static async verifyEmail(id) {
        await this.update(id, { email_verified: true });
    }
    static async isEmailAvailable(email) {
        const user = await this.findByEmail(email);
        return user === null;
    }
    static async getPasswordHash(userId) {
        try {
            const { data, error } = await database_1.default
                .from('user_auth')
                .select('password_hash')
                .eq('user_id', userId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') { // No rows found
                    return null;
                }
                logger_1.default.error('Error fetching password hash:', error);
                throw new errors_1.InternalError('Failed to fetch authentication data');
            }
            return data?.password_hash || null;
        }
        catch (error) {
            if (error instanceof errors_1.InternalError)
                throw error;
            logger_1.default.error('Unexpected error in getPasswordHash:', error);
            throw new errors_1.InternalError('Failed to fetch authentication data');
        }
    }
    static async updatePasswordHash(userId, newPasswordHash) {
        try {
            const { error } = await database_1.default
                .from('user_auth')
                .update({
                password_hash: newPasswordHash,
                password_changed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
                .eq('user_id', userId);
            if (error) {
                logger_1.default.error('Error updating password:', error);
                throw new errors_1.InternalError('Failed to update password');
            }
        }
        catch (error) {
            if (error instanceof errors_1.InternalError)
                throw error;
            logger_1.default.error('Unexpected error in updatePasswordHash:', error);
            throw new errors_1.InternalError('Failed to update password');
        }
    }
    static async recordAuthEvent(userId, eventType, ipAddress, userAgent, metadata) {
        try {
            const { error } = await database_1.default
                .from('auth_events')
                .insert({
                id: (0, uuid_1.v4)(),
                user_id: userId,
                event_type: eventType,
                ip_address: ipAddress || null,
                user_agent: userAgent || null,
                metadata: metadata || {},
                created_at: new Date().toISOString()
            });
            if (error) {
                logger_1.default.error('Error recording auth event:', error);
                // Don't throw - this is not critical
            }
        }
        catch (error) {
            logger_1.default.error('Unexpected error in recordAuthEvent:', error);
        }
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=userRepository.js.map