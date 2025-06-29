"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
class TransactionRepository {
    /**
     * Get transaction by ID
     */
    static async findById(transactionId) {
        try {
            const { data, error } = await database_1.default
                .from('transactions')
                .select('*')
                .eq('id', transactionId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Not found
                }
                throw error;
            }
            return data;
        }
        catch (error) {
            logger_1.default.error('Failed to find transaction:', error);
            throw new errors_1.DatabaseError('Failed to retrieve transaction', error);
        }
    }
    /**
     * Get transactions for a user with filters and pagination
     */
    static async findByUser(userId, filters = {}, pagination) {
        try {
            let query = database_1.default
                .from('transactions')
                .select('*', { count: 'exact' })
                .eq('user_id', userId);
            // Apply filters
            if (filters.card_id) {
                query = query.eq('card_id', filters.card_id);
            }
            if (filters.type) {
                query = query.eq('type', filters.type);
            }
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.from_date) {
                query = query.gte('created_at', filters.from_date.toISOString());
            }
            if (filters.to_date) {
                query = query.lte('created_at', filters.to_date.toISOString());
            }
            if (filters.min_amount !== undefined) {
                query = query.gte('amount', filters.min_amount);
            }
            if (filters.max_amount !== undefined) {
                query = query.lte('amount', filters.max_amount);
            }
            if (filters.merchant_name) {
                query = query.ilike('merchant_name', `%${filters.merchant_name}%`);
            }
            // Apply ordering
            const orderBy = pagination.orderBy || 'created_at';
            const orderDirection = pagination.orderDirection || 'desc';
            query = query.order(orderBy, { ascending: orderDirection === 'asc' });
            // Apply pagination
            const { page, limit } = pagination;
            const offset = (page - 1) * limit;
            query = query.range(offset, offset + limit - 1);
            const { data, error, count } = await query;
            if (error)
                throw error;
            return {
                transactions: data || [],
                total: count || 0
            };
        }
        catch (error) {
            logger_1.default.error('Failed to find user transactions:', error);
            throw new errors_1.DatabaseError('Failed to retrieve transactions', error);
        }
    }
    /**
     * Get transactions for a specific card
     */
    static async findByCard(cardId, pagination) {
        try {
            const { page, limit } = pagination;
            const offset = (page - 1) * limit;
            const { data, error, count } = await database_1.default
                .from('transactions')
                .select('*', { count: 'exact' })
                .eq('card_id', cardId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            if (error)
                throw error;
            return {
                transactions: data || [],
                total: count || 0
            };
        }
        catch (error) {
            logger_1.default.error('Failed to find card transactions:', error);
            throw new errors_1.DatabaseError('Failed to retrieve card transactions', error);
        }
    }
    /**
     * Create a new transaction (for mock purposes)
     */
    static async create(data) {
        try {
            const { data: transaction, error } = await database_1.default
                .from('transactions')
                .insert(data)
                .select()
                .single();
            if (error)
                throw error;
            logger_1.default.info(`Transaction created`, {
                transactionId: transaction.id,
                type: transaction.type,
                amount: transaction.amount
            });
            return transaction;
        }
        catch (error) {
            logger_1.default.error('Failed to create transaction:', error);
            throw new errors_1.DatabaseError('Failed to create transaction', error);
        }
    }
    /**
     * Update transaction status
     */
    static async updateStatus(transactionId, status, additionalData) {
        try {
            const updateData = { status };
            if (additionalData) {
                Object.assign(updateData, additionalData);
            }
            const { data, error } = await database_1.default
                .from('transactions')
                .update(updateData)
                .eq('id', transactionId)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            logger_1.default.error('Failed to update transaction status:', error);
            throw new errors_1.DatabaseError('Failed to update transaction', error);
        }
    }
    /**
     * Create a dispute for a transaction
     */
    static async createDispute(transactionId, reason) {
        try {
            const { data, error } = await database_1.default
                .from('transactions')
                .update({
                status: 'disputed',
                dispute_reason: reason,
                dispute_status: 'pending'
            })
                .eq('id', transactionId)
                .select()
                .single();
            if (error)
                throw error;
            logger_1.default.info(`Transaction disputed`, { transactionId, reason });
            return data;
        }
        catch (error) {
            logger_1.default.error('Failed to create dispute:', error);
            throw new errors_1.DatabaseError('Failed to create dispute', error);
        }
    }
    /**
     * Get transaction statistics for a user
     */
    static async getUserStats(userId, period) {
        try {
            let query = database_1.default
                .from('transactions')
                .select('type, status, amount, currency')
                .eq('user_id', userId)
                .eq('status', 'completed');
            if (period) {
                query = query
                    .gte('created_at', period.from.toISOString())
                    .lte('created_at', period.to.toISOString());
            }
            const { data, error } = await query;
            if (error)
                throw error;
            // Calculate statistics
            const stats = {
                totalTransactions: data?.length || 0,
                totalAmount: data?.reduce((sum, tx) => sum + tx.amount, 0) || 0,
                byType: {},
                byCurrency: {}
            };
            data?.forEach(tx => {
                stats.byType[tx.type] = (stats.byType[tx.type] || 0) + 1;
                stats.byCurrency[tx.currency] = (stats.byCurrency[tx.currency] || 0) + tx.amount;
            });
            return stats;
        }
        catch (error) {
            logger_1.default.error('Failed to get user stats:', error);
            throw new errors_1.DatabaseError('Failed to retrieve statistics', error);
        }
    }
    /**
     * Sync transaction from Admediacards
     */
    static async syncFromAdmediacards(cardId, admediacardsTransaction) {
        try {
            // Check if transaction already exists
            const { data: existingTx } = await database_1.default
                .from('transactions')
                .select('id')
                .eq('admediacards_transaction_id', admediacardsTransaction.TransactionID)
                .single();
            if (existingTx) {
                // Update existing transaction
                const { data: updated, error } = await database_1.default
                    .from('transactions')
                    .update({
                    status: this.mapAdmediacardsStatus(admediacardsTransaction.Status),
                    response_code: admediacardsTransaction.ResponseCode,
                    response_message: admediacardsTransaction.ResponseMessage,
                    synced_at: new Date(),
                    metadata: {
                        ...admediacardsTransaction,
                        last_sync: new Date().toISOString()
                    }
                })
                    .eq('id', existingTx.id)
                    .select()
                    .single();
                if (error)
                    throw error;
                return updated;
            }
            else {
                // Get card to find user_id
                const { data: card } = await database_1.default
                    .from('virtual_cards')
                    .select('user_id')
                    .eq('id', cardId)
                    .single();
                if (!card)
                    throw new Error('Card not found');
                // Create new transaction
                const { data: created, error } = await database_1.default
                    .from('transactions')
                    .insert({
                    user_id: card.user_id,
                    card_id: cardId,
                    admediacards_transaction_id: admediacardsTransaction.TransactionID,
                    type: this.mapAdmediacardsType(admediacardsTransaction.Type),
                    amount: admediacardsTransaction.Amount,
                    currency: admediacardsTransaction.Currency || 'USD',
                    merchant_name: admediacardsTransaction.MerchantName,
                    merchant_category: admediacardsTransaction.MerchantCategory,
                    merchant_country: admediacardsTransaction.MerchantCountry,
                    status: this.mapAdmediacardsStatus(admediacardsTransaction.Status),
                    response_code: admediacardsTransaction.ResponseCode,
                    response_message: admediacardsTransaction.ResponseMessage,
                    synced_at: new Date(),
                    metadata: admediacardsTransaction
                })
                    .select()
                    .single();
                if (error)
                    throw error;
                return created;
            }
        }
        catch (error) {
            logger_1.default.error('Failed to sync transaction from Admediacards:', error);
            throw new errors_1.DatabaseError('Failed to sync transaction', error);
        }
    }
    /**
     * Map Admediacards transaction type to our type
     */
    static mapAdmediacardsType(type) {
        const typeMap = {
            'AUTHORIZATION': 'authorization',
            'CAPTURE': 'capture',
            'REFUND': 'refund',
            'REVERSAL': 'reversal',
            'AUTHORIZATION_REVERSAL': 'reversal'
        };
        return typeMap[type?.toUpperCase()] || 'authorization';
    }
    /**
     * Map Admediacards status to our status
     */
    static mapAdmediacardsStatus(status) {
        const statusMap = {
            'APPROVED': 'completed',
            'DECLINED': 'failed',
            'PENDING': 'pending',
            'REVERSED': 'reversed'
        };
        return statusMap[status?.toUpperCase()] || 'pending';
    }
}
exports.TransactionRepository = TransactionRepository;
//# sourceMappingURL=transactionRepository.js.map