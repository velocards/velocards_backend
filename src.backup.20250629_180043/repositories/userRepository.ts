import { v4 as uuidv4 } from 'uuid';
  import  supabase  from '../config/database'; // Changed: Added curly braces for named export
  import { ConflictError, NotFoundError, InternalError } from '../utils/errors';
  import logger from '../utils/logger';

  export interface User {
    id: string;
    email: string;
    phone?: string | null;
    email_verified: boolean;
    kyc_status: 'pending' | 'approved' | 'rejected' | 'expired';
    kyc_completed_at?: Date | null;
    risk_score: number;
    account_status: 'active' | 'suspended' | 'closed';
    virtual_balance: number;
    total_spent: number;
    role?: string; // User role (user, admin, support)
    tier_id?: string | null;
    tier_assigned_at?: Date | null;
    tier?: {
      id: string;
      tier_level: number;
      name: string;
      display_name: string;
      description?: string;
      features?: any;
    };
    metadata: {
      first_name?: string;
      last_name?: string;
      password_hash?: string; // Temporarily store password hash in metadata
      [key: string]: any;
    };
    created_at: Date;
    updated_at: Date;
  }

  export interface CreateUserData {
    email: string;
    password_hash: string;
    phone?: string | null;
    role?: string;
    metadata: {
      first_name: string;
      last_name: string;
    };
  }

  export interface UpdateUserData {
    phone?: string | null;
    email_verified?: boolean;
    kyc_status?: User['kyc_status'];
    account_status?: User['account_status'];
    metadata?: Partial<User['metadata']>;
  }

  export class UserRepository {
    static supabase = supabase;

    static async create(data: CreateUserData): Promise<User> {
      try {
        logger.info('Creating new user:', { email: data.email });
        
        // First check if user already exists in our profiles
        const existingUser = await this.findByEmail(data.email);
        if (existingUser) {
          throw new ConflictError('Email already exists');
        }

        // Generate a UUID for the new user
        const userId = uuidv4();
        logger.info('Generated user ID:', userId);

        // Create user profile directly (no more Supabase Auth dependency)
        const { data: user, error } = await supabase
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
            throw new ConflictError('Email already exists');
          }
          logger.error('Error creating user:', error);
          throw new InternalError('Failed to create user');
        }

        // Now create the auth record in user_auth table
        logger.info('Creating auth record for user:', userId);
        const { error: authError } = await supabase
          .from('user_auth')
          .insert({
            user_id: userId,
            password_hash: data.password_hash,
            created_at: new Date().toISOString()
          });

        if (authError) {
          // If auth record fails, we should delete the user profile
          logger.error('Failed to create auth record, rolling back user profile');
          await supabase.from('user_profiles').delete().eq('id', userId);
          logger.error('Error creating auth record:', authError);
          throw new InternalError('Failed to create user authentication');
        }
        
        logger.info('User created successfully:', { userId, email: user.email });

        return user;
      } catch (error) {
        if (error instanceof ConflictError) throw error;
        logger.error('Unexpected error in create user:', error);
        throw new InternalError('Failed to create user');
      }
    }

    static async findById(id: string): Promise<User | null> {
      try {
        const { data: user, error } = await supabase
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
          logger.error('Error finding user by id:', error);
          throw new InternalError('Failed to fetch user');
        }

        return user;
      } catch (error) {
        if (error instanceof InternalError) throw error;
        logger.error('Unexpected error in findById:', error);
        throw new InternalError('Failed to fetch user');
      }
    }

    static async findByEmail(email: string): Promise<User | null> {
      try {
        const { data: user, error } = await supabase
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
          logger.error('Error finding user by email:', error);
          throw new InternalError('Failed to fetch user');
        }

        logger.info('User found with tier info:', { 
          userId: user?.id, 
          email: user?.email,
          hasTier: !!user?.tier,
          tierLevel: user?.tier?.tier_level
        });

        return user;
      } catch (error) {
        if (error instanceof InternalError) throw error;
        logger.error('Unexpected error in findByEmail:', error);
        throw new InternalError('Failed to fetch user');
      }
    }

    static async updateBalance(id: string, newBalance: number): Promise<User> {
      try {
        const { data: user, error } = await supabase
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
            throw new NotFoundError('User');
          }
          logger.error('Error updating user balance:', error);
          throw new InternalError('Failed to update user balance');
        }

        return user;
      } catch (error) {
        if (error instanceof NotFoundError || error instanceof InternalError) throw error;
        logger.error('Unexpected error in updateBalance:', error);
        throw new InternalError('Failed to update user balance');
      }
    }

    static async update(id: string, data: UpdateUserData): Promise<User> {
      try {
        // Prepare update data
        const updateData: any = {
          updated_at: new Date().toISOString()
        };

        // Only add fields that are provided
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.email_verified !== undefined) updateData.email_verified = data.email_verified;
        if (data.kyc_status !== undefined) updateData.kyc_status = data.kyc_status;
        if (data.account_status !== undefined) updateData.account_status = data.account_status;
        if (data.metadata !== undefined) updateData.metadata = data.metadata;

        const { data: user, error } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            throw new NotFoundError('User');
          }
          logger.error('Error updating user:', error);
          throw new InternalError('Failed to update user');
        }

        return user;
      } catch (error) {
        if (error instanceof NotFoundError) throw error;
        if (error instanceof InternalError) throw error;
        logger.error('Unexpected error in update user:', error);
        throw new InternalError('Failed to update user');
      }
    }

    static async adjustBalance(
      id: string,
      amount: number,
      operation: 'add' | 'subtract'
    ): Promise<User> {
      try {
        // First get current balance
        const user = await this.findById(id);
        if (!user) {
          throw new NotFoundError('User');
        }

        const newBalance = operation === 'add'
          ? user.virtual_balance + amount
          : user.virtual_balance - amount;

        if (newBalance < 0) {
          throw new ConflictError('Insufficient balance');
        }

        const { data: updatedUser, error } = await supabase
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
          logger.error('Error updating balance:', error);
          throw new InternalError('Failed to update balance');
        }

        // Record in balance ledger
        await this.recordBalanceChange(
          id,
          amount,
          operation,
          user.virtual_balance,
          newBalance
        );

        return updatedUser;
      } catch (error) {
        if (error instanceof NotFoundError || error instanceof ConflictError) throw error;
        logger.error('Unexpected error in updateBalance:', error);
        throw new InternalError('Failed to update balance');
      }
    }

    private static async recordBalanceChange(
      userId: string,
      amount: number,
      operation: 'add' | 'subtract',
      balanceBefore: number,
      balanceAfter: number
    ): Promise<void> {
      try {
        const { error } = await supabase
          .from('user_balance_ledger')
          .insert({
            id: uuidv4(), // Added: id field is required in schema
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
          logger.error('Error recording balance change:', error);
          // Don't throw here, this is not critical
        }
      } catch (error) {
        logger.error('Unexpected error in recordBalanceChange:', error);
      }
    }

    static async verifyEmail(id: string): Promise<void> {
      await this.update(id, { email_verified: true });
    }

    static async isEmailAvailable(email: string): Promise<boolean> {
      const user = await this.findByEmail(email);
      return user === null;
    }

    static async getPasswordHash(userId: string): Promise<string | null> {
      try {
        const { data, error } = await supabase
          .from('user_auth')
          .select('password_hash')
          .eq('user_id', userId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') { // No rows found
            return null;
          }
          logger.error('Error fetching password hash:', error);
          throw new InternalError('Failed to fetch authentication data');
        }

        return data?.password_hash || null;
      } catch (error) {
        if (error instanceof InternalError) throw error;
        logger.error('Unexpected error in getPasswordHash:', error);
        throw new InternalError('Failed to fetch authentication data');
      }
    }

    static async updatePasswordHash(userId: string, newPasswordHash: string): Promise<void> {
      try {
        const { error } = await supabase
          .from('user_auth')
          .update({ 
            password_hash: newPasswordHash,
            password_changed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (error) {
          logger.error('Error updating password:', error);
          throw new InternalError('Failed to update password');
        }
      } catch (error) {
        if (error instanceof InternalError) throw error;
        logger.error('Unexpected error in updatePasswordHash:', error);
        throw new InternalError('Failed to update password');
      }
    }

    static async recordAuthEvent(
      userId: string | null,
      eventType: string,
      ipAddress?: string,
      userAgent?: string,
      metadata?: any
    ): Promise<void> {
      try {
        const { error } = await supabase
          .from('auth_events')
          .insert({
            id: uuidv4(),
            user_id: userId,
            event_type: eventType,
            ip_address: ipAddress || null,
            user_agent: userAgent || null,
            metadata: metadata || {},
            created_at: new Date().toISOString()
          });

        if (error) {
          logger.error('Error recording auth event:', error);
          // Don't throw - this is not critical
        }
      } catch (error) {
        logger.error('Unexpected error in recordAuthEvent:', error);
      }
    }
  }