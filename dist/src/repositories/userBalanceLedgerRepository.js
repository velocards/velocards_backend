"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBalanceLedgerRepository = void 0;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
class UserBalanceLedgerRepository {
    static supabase = database_1.supabase;
    static async create(data) {
        try {
            const { data: ledgerEntry, error } = await database_1.supabase
                .from('user_balance_ledger')
                .insert([{
                    user_id: data.user_id,
                    transaction_type: data.transaction_type,
                    amount: data.amount,
                    balance_before: data.balance_before,
                    balance_after: data.balance_after,
                    reference_type: data.reference_type,
                    reference_id: data.reference_id,
                    description: data.description
                }])
                .select()
                .single();
            if (error) {
                logger_1.default.error('Failed to create balance ledger entry', { error, data });
                throw new Error(`Failed to create balance ledger entry: ${error.message}`);
            }
            return ledgerEntry;
        }
        catch (error) {
            logger_1.default.error('Error creating balance ledger entry', { error: error.message, data });
            throw error;
        }
    }
    static async findByUserId(userId, options = {}) {
        try {
            const { limit = 50, page = 1 } = options;
            const offset = (page - 1) * limit;
            // Get total count
            const { count, error: countError } = await database_1.supabase
                .from('user_balance_ledger')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);
            if (countError) {
                logger_1.default.error('Failed to count balance ledger entries', { error: countError, userId });
                throw new Error(`Failed to count balance ledger entries: ${countError.message}`);
            }
            // Get entries
            const { data, error } = await database_1.supabase
                .from('user_balance_ledger')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (error) {
                logger_1.default.error('Failed to find balance ledger entries', { error, userId });
                throw new Error(`Failed to find balance ledger entries: ${error.message}`);
            }
            return {
                entries: data || [],
                total: count || 0
            };
        }
        catch (error) {
            logger_1.default.error('Error finding balance ledger entries', { error: error.message, userId });
            throw error;
        }
    }
    static async findByUserIdAndType(userId, transactionType, options = {}) {
        try {
            const { limit = 50, page = 1 } = options;
            const offset = (page - 1) * limit;
            // Get total count
            const { count, error: countError } = await database_1.supabase
                .from('user_balance_ledger')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('transaction_type', transactionType);
            if (countError) {
                logger_1.default.error('Failed to count balance ledger entries by type', { error: countError, userId, transactionType });
                throw new Error(`Failed to count balance ledger entries: ${countError.message}`);
            }
            // Get entries
            const { data, error } = await database_1.supabase
                .from('user_balance_ledger')
                .select('*')
                .eq('user_id', userId)
                .eq('transaction_type', transactionType)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (error) {
                logger_1.default.error('Failed to find balance ledger entries by type', { error, userId, transactionType });
                throw new Error(`Failed to find balance ledger entries: ${error.message}`);
            }
            return {
                entries: data || [],
                total: count || 0
            };
        }
        catch (error) {
            logger_1.default.error('Error finding balance ledger entries by type', { error: error.message, userId, transactionType });
            throw error;
        }
    }
    static async findByDateRange(userId, startDate, endDate, options = {}) {
        try {
            const { limit = 50, page = 1 } = options;
            const offset = (page - 1) * limit;
            // Get total count
            const { count, error: countError } = await database_1.supabase
                .from('user_balance_ledger')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());
            if (countError) {
                logger_1.default.error('Failed to count balance ledger entries by date range', { error: countError, userId, startDate, endDate });
                throw new Error(`Failed to count balance ledger entries: ${countError.message}`);
            }
            // Get entries
            const { data, error } = await database_1.supabase
                .from('user_balance_ledger')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (error) {
                logger_1.default.error('Failed to find balance ledger entries by date range', { error, userId, startDate, endDate });
                throw new Error(`Failed to find balance ledger entries: ${error.message}`);
            }
            return {
                entries: data || [],
                total: count || 0
            };
        }
        catch (error) {
            logger_1.default.error('Error finding balance ledger entries by date range', { error: error.message, userId, startDate, endDate });
            throw error;
        }
    }
    static async getUserBalanceSummary(userId) {
        try {
            const { data, error } = await database_1.supabase
                .from('user_balance_ledger')
                .select('amount, created_at')
                .eq('user_id', userId);
            if (error) {
                logger_1.default.error('Failed to get user balance summary', { error, userId });
                throw new Error(`Failed to get user balance summary: ${error.message}`);
            }
            const entries = data || [];
            const summary = {
                totalCredits: 0,
                totalDebits: 0,
                netAmount: 0,
                transactionCount: entries.length
            };
            if (entries.length > 0) {
                summary.lastTransaction = new Date(Math.max(...entries.map(e => new Date(e.created_at).getTime())));
            }
            entries.forEach(entry => {
                if (entry.amount > 0) {
                    summary.totalCredits += entry.amount;
                }
                else {
                    summary.totalDebits += Math.abs(entry.amount);
                }
                summary.netAmount += entry.amount;
            });
            return summary;
        }
        catch (error) {
            logger_1.default.error('Error getting user balance summary', { error: error.message, userId });
            throw error;
        }
    }
    static async getLatestBalance(userId) {
        try {
            const { data, error } = await database_1.supabase
                .from('user_balance_ledger')
                .select('balance_after')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (error && error.code !== 'PGRST116') {
                logger_1.default.error('Failed to get latest balance', { error, userId });
                throw new Error(`Failed to get latest balance: ${error.message}`);
            }
            return data?.balance_after || null;
        }
        catch (error) {
            logger_1.default.error('Error getting latest balance', { error: error.message, userId });
            throw error;
        }
    }
    static async findByReference(referenceType, referenceId) {
        try {
            const { data, error } = await database_1.supabase
                .from('user_balance_ledger')
                .select('*')
                .eq('reference_type', referenceType)
                .eq('reference_id', referenceId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.default.error('Failed to find balance ledger entries by reference', { error, referenceType, referenceId });
                throw new Error(`Failed to find balance ledger entries: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error finding balance ledger entries by reference', { error: error.message, referenceType, referenceId });
            throw error;
        }
    }
}
exports.UserBalanceLedgerRepository = UserBalanceLedgerRepository;
//# sourceMappingURL=userBalanceLedgerRepository.js.map