"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoTransactionRepository = void 0;
const database_1 = require("../config/database");
const logger_1 = __importDefault(require("../utils/logger"));
class CryptoTransactionRepository {
    static supabase = database_1.supabase;
    static async create(data) {
        try {
            const { data: transaction, error } = await database_1.supabase
                .from('crypto_transactions')
                .insert([{
                    user_id: data.user_id,
                    xmoney_payment_id: data.xmoney_payment_id,
                    type: data.type,
                    crypto_currency: data.crypto_currency,
                    crypto_amount: data.crypto_amount,
                    fiat_currency: data.fiat_currency,
                    fiat_amount: data.fiat_amount,
                    exchange_rate: data.exchange_rate,
                    wallet_address: data.wallet_address,
                    status: data.status || 'pending',
                    confirmations: 0,
                    metadata: data.metadata
                }])
                .select()
                .single();
            if (error) {
                logger_1.default.error('Failed to create crypto transaction', { error, data });
                throw new Error(`Failed to create crypto transaction: ${error.message}`);
            }
            return transaction;
        }
        catch (error) {
            logger_1.default.error('Error creating crypto transaction', { error: error.message, data });
            throw error;
        }
    }
    static async findById(id) {
        try {
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .eq('id', id)
                .single();
            if (error && error.code !== 'PGRST116') {
                logger_1.default.error('Failed to find crypto transaction by ID', { error, id });
                throw new Error(`Failed to find crypto transaction: ${error.message}`);
            }
            return data;
        }
        catch (error) {
            logger_1.default.error('Error finding crypto transaction by ID', { error: error.message, id });
            throw error;
        }
    }
    static async findByXMoneyId(xmoneyPaymentId) {
        try {
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .eq('xmoney_payment_id', xmoneyPaymentId)
                .single();
            if (error && error.code !== 'PGRST116') {
                logger_1.default.error('Failed to find crypto transaction by xMoney ID', { error, xmoneyPaymentId });
                throw new Error(`Failed to find crypto transaction: ${error.message}`);
            }
            return data;
        }
        catch (error) {
            logger_1.default.error('Error finding crypto transaction by xMoney ID', { error: error.message, xmoneyPaymentId });
            throw error;
        }
    }
    static async findByUserId(userId) {
        try {
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.default.error('Failed to find crypto transactions by user ID', { error, userId });
                throw new Error(`Failed to find crypto transactions: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error finding crypto transactions by user ID', { error: error.message, userId });
            throw error;
        }
    }
    static async findPendingByUser(userId) {
        try {
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .eq('user_id', userId)
                .in('status', ['pending', 'confirming'])
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.default.error('Failed to find pending crypto transactions', { error, userId });
                throw new Error(`Failed to find pending crypto transactions: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error finding pending crypto transactions', { error: error.message, userId });
            throw error;
        }
    }
    static async findPendingAfter(cutoffTime) {
        try {
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .in('status', ['pending', 'confirming'])
                .gte('created_at', cutoffTime.toISOString())
                .order('created_at', { ascending: false });
            if (error) {
                logger_1.default.error('Failed to find pending crypto transactions after cutoff', { error, cutoffTime });
                throw new Error(`Failed to find pending crypto transactions: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error finding pending crypto transactions after cutoff', { error: error.message, cutoffTime });
            throw error;
        }
    }
    static async findStuckOrders(cutoffTime) {
        try {
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .eq('status', 'pending')
                .lt('created_at', cutoffTime.toISOString())
                .order('created_at', { ascending: true });
            if (error) {
                logger_1.default.error('Failed to find stuck crypto orders', { error, cutoffTime });
                throw new Error(`Failed to find stuck crypto orders: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error finding stuck crypto orders', { error: error.message, cutoffTime });
            throw error;
        }
    }
    static async findExpiredOrders(cutoffTime) {
        try {
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .in('status', ['pending', 'confirming'])
                .lt('created_at', cutoffTime.toISOString())
                .order('created_at', { ascending: true });
            if (error) {
                logger_1.default.error('Failed to find expired crypto orders', { error, cutoffTime });
                throw new Error(`Failed to find expired crypto orders: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error finding expired crypto orders', { error: error.message, cutoffTime });
            throw error;
        }
    }
    static async findInconsistentStates() {
        try {
            // Find transactions that haven't been synced in over 1 hour but are still pending
            const oneHourAgo = new Date();
            oneHourAgo.setHours(oneHourAgo.getHours() - 1);
            const { data, error } = await database_1.supabase
                .from('crypto_transactions')
                .select('*')
                .in('status', ['pending', 'confirming'])
                .or(`synced_at.is.null,synced_at.lt.${oneHourAgo.toISOString()}`)
                .order('created_at', { ascending: true });
            if (error) {
                logger_1.default.error('Failed to find inconsistent crypto orders', { error });
                throw new Error(`Failed to find inconsistent crypto orders: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Error finding inconsistent crypto orders', { error: error.message });
            throw error;
        }
    }
    static async updateFromXMoney(id, data) {
        try {
            const { data: transaction, error } = await database_1.supabase
                .from('crypto_transactions')
                .update({
                ...data,
                updated_at: new Date().toISOString()
            })
                .eq('id', id)
                .select()
                .single();
            if (error) {
                logger_1.default.error('Failed to update crypto transaction from xMoney', { error, id, data });
                throw new Error(`Failed to update crypto transaction: ${error.message}`);
            }
            return transaction;
        }
        catch (error) {
            logger_1.default.error('Error updating crypto transaction from xMoney', { error: error.message, id, data });
            throw error;
        }
    }
    static async markAsProcessed(id) {
        try {
            const { error } = await database_1.supabase
                .from('crypto_transactions')
                .update({
                metadata: { processed_at: new Date().toISOString() },
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (error) {
                logger_1.default.error('Failed to mark crypto transaction as processed', { error, id });
                throw new Error(`Failed to mark crypto transaction as processed: ${error.message}`);
            }
        }
        catch (error) {
            logger_1.default.error('Error marking crypto transaction as processed', { error: error.message, id });
            throw error;
        }
    }
    static async markAsExpired(id) {
        try {
            const { error } = await database_1.supabase
                .from('crypto_transactions')
                .update({
                status: 'expired',
                updated_at: new Date().toISOString()
            })
                .eq('id', id);
            if (error) {
                logger_1.default.error('Failed to mark crypto transaction as expired', { error, id });
                throw new Error(`Failed to mark crypto transaction as expired: ${error.message}`);
            }
        }
        catch (error) {
            logger_1.default.error('Error marking crypto transaction as expired', { error: error.message, id });
            throw error;
        }
    }
}
exports.CryptoTransactionRepository = CryptoTransactionRepository;
//# sourceMappingURL=cryptoTransactionRepository.js.map