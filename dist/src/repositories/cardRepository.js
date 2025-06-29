"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const errors_1 = require("../utils/errors");
const logger_1 = __importDefault(require("../utils/logger"));
class DatabaseError extends errors_1.AppError {
    constructor(message, originalError) {
        super('DATABASE_ERROR', message, 500);
        if (originalError) {
            this.stack = originalError.stack;
        }
    }
}
class CardRepository {
    /**
     * Create a new virtual card
     */
    static async create(data) {
        try {
            // Validate required fields
            if (!data.program_id) {
                throw new Error('Program ID is required for card creation');
            }
            if (!data.bin) {
                throw new Error('BIN is required for card creation');
            }
            if (!data.exp_month || !data.exp_year) {
                throw new Error('Expiry date is required for card creation');
            }
            if (!data.currency) {
                throw new Error('Currency is required for card creation');
            }
            const { data: card, error } = await database_1.default
                .from('virtual_cards')
                .insert({
                ...data,
                program_id: data.program_id,
                bin: data.bin,
                name: data.name || `Virtual Card ${data.card_type}`,
                address: data.address,
                phone_number: data.phone_number,
                exp_month: data.exp_month,
                exp_year: data.exp_year,
                is_active: true,
                spent_amount: 0,
                status: 'active',
                currency: data.currency,
                limit_amount: data.spending_limit, // Map spending_limit to limit_amount
                // New cardholder fields
                first_name: data.first_name,
                last_name: data.last_name,
                street_address: data.street_address,
                city: data.city,
                state: data.state,
                postal_code: data.postal_code,
                country: data.country,
                nickname: data.nickname
            })
                .select()
                .single();
            if (error)
                throw error;
            logger_1.default.info(`Card created for user ${data.user_id}`, {
                cardId: card.id,
                cardToken: card.card_token
            });
            return card;
        }
        catch (error) {
            logger_1.default.error('Failed to create card:', {
                error: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                data: data
            });
            throw new DatabaseError('Failed to create card', error);
        }
    }
    /**
     * Find a card by ID
     */
    static async findById(cardId) {
        try {
            const { data, error } = await database_1.default
                .from('virtual_cards')
                .select('*')
                .eq('id', cardId)
                .single();
            if (error && error.code !== 'PGRST116')
                throw error;
            return data;
        }
        catch (error) {
            logger_1.default.error('Failed to find card:', error);
            throw new DatabaseError('Failed to find card', error);
        }
    }
    /**
     * Find a card by card token
     */
    static async findByToken(cardToken) {
        try {
            const { data, error } = await database_1.default
                .from('virtual_cards')
                .select('*')
                .eq('card_token', cardToken)
                .single();
            if (error && error.code !== 'PGRST116')
                throw error;
            return data;
        }
        catch (error) {
            logger_1.default.error('Failed to find card by token:', error);
            throw new DatabaseError('Failed to find card', error);
        }
    }
    /**
     * Find all cards for a user
     */
    static async findByUserId(userId, includeDeleted = false) {
        try {
            let query = database_1.default
                .from('virtual_cards')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (!includeDeleted) {
                query = query.neq('status', 'deleted');
            }
            const { data, error } = await query;
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Failed to find user cards:', error);
            throw new DatabaseError('Failed to find user cards', error);
        }
    }
    /**
     * Update a card
     */
    static async update(cardId, data) {
        try {
            const { data: updatedCard, error } = await database_1.default
                .from('virtual_cards')
                .update({
                ...data,
                updated_at: new Date().toISOString()
            })
                .eq('id', cardId)
                .select()
                .single();
            if (error)
                throw error;
            logger_1.default.info(`Card updated: ${cardId}`, {
                updates: Object.keys(data)
            });
            return updatedCard;
        }
        catch (error) {
            logger_1.default.error('Failed to update card:', error);
            throw new DatabaseError('Failed to update card', error);
        }
    }
    /**
     * Update card spending
     */
    static async updateSpending(cardId, amount) {
        try {
            // First get the current card
            const card = await this.findById(cardId);
            if (!card) {
                throw new Error('Card not found');
            }
            const newSpentAmount = card.spent_amount + amount;
            const newRemainingBalance = card.spending_limit - newSpentAmount;
            if (newRemainingBalance < 0) {
                throw new Error('Insufficient card balance');
            }
            return await this.update(cardId, {
                spent_amount: newSpentAmount,
                remaining_balance: newRemainingBalance
            });
        }
        catch (error) {
            logger_1.default.error('Failed to update card spending:', error);
            throw new DatabaseError('Failed to update card spending', error);
        }
    }
    /**
     * Get total active cards balance for a user
     */
    static async getUserTotalCardBalance(userId) {
        try {
            const { data, error } = await database_1.default
                .from('virtual_cards')
                .select('remaining_balance')
                .eq('user_id', userId)
                .eq('status', 'active');
            if (error)
                throw error;
            const total = data?.reduce((sum, card) => sum + (card.remaining_balance || 0), 0) || 0;
            return total;
        }
        catch (error) {
            logger_1.default.error('Failed to get user card balance:', error);
            throw new DatabaseError('Failed to get user card balance', error);
        }
    }
    /**
     * Count active cards for a user
     */
    static async countActiveCards(userId) {
        try {
            const { count, error } = await database_1.default
                .from('virtual_cards')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'active');
            if (error)
                throw error;
            return count || 0;
        }
        catch (error) {
            logger_1.default.error('Failed to count active cards:', error);
            throw new DatabaseError('Failed to count active cards', error);
        }
    }
    /**
     * Find all active cards in the system
     */
    static async findAllActive() {
        try {
            const { data, error } = await database_1.default
                .from('virtual_cards')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            logger_1.default.error('Failed to find all active cards:', error);
            throw new DatabaseError('Failed to find all active cards', error);
        }
    }
    /**
     * Update last synced timestamp
     */
    static async updateLastSyncedAt(cardId) {
        try {
            const { error } = await database_1.default
                .from('virtual_cards')
                .update({
                last_synced_at: new Date().toISOString()
            })
                .eq('id', cardId);
            if (error)
                throw error;
            logger_1.default.debug(`Updated last sync time for card: ${cardId}`);
        }
        catch (error) {
            logger_1.default.error('Failed to update last synced at:', error);
            throw new DatabaseError('Failed to update last synced at', error);
        }
    }
    /**
     * Update card from Admediacards response
     */
    static async updateFromAdmediacards(cardId, data) {
        try {
            const { data: updatedCard, error } = await database_1.default
                .from('virtual_cards')
                .update({
                ...data,
                updated_at: new Date().toISOString()
            })
                .eq('id', cardId)
                .select()
                .single();
            if (error)
                throw error;
            logger_1.default.info(`Card synced from Admediacards: ${cardId}`);
            return updatedCard;
        }
        catch (error) {
            logger_1.default.error('Failed to update card from Admediacards:', error);
            throw new DatabaseError('Failed to update card from Admediacards', error);
        }
    }
}
exports.CardRepository = CardRepository;
//# sourceMappingURL=cardRepository.js.map