"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admediacardsClient = exports.AdmediacardsRealClient = void 0;
const axios_1 = __importStar(require("axios"));
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../../utils/logger"));
const errors_1 = require("../../utils/errors");
const env_1 = require("../../config/env");
const database_1 = __importDefault(require("../../config/database"));
class AdmediacardsRealClient {
    axios;
    apiKey;
    baseUrl;
    testMode;
    maxTestCards;
    // @ts-ignore - Will be used for master account operations
    accountId;
    constructor() {
        this.apiKey = env_1.admediacards.apiKey;
        this.baseUrl = env_1.admediacards.baseUrl;
        this.testMode = env_1.admediacards.testMode;
        this.maxTestCards = env_1.admediacards.maxTestCards;
        this.accountId = env_1.admediacards.accountId;
        // Create axios instance with default config
        this.axios = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'Authorization': `ApiKey ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        // Add request interceptor for logging
        this.axios.interceptors.request.use((config) => {
            logger_1.default.info('Admediacards API Request', {
                method: config.method,
                url: config.url,
                params: config.params,
                data: config.data
            });
            return config;
        }, (error) => {
            logger_1.default.error('Admediacards Request Error', error);
            return Promise.reject(error);
        });
        // Add response interceptor for logging and error handling
        this.axios.interceptors.response.use((response) => {
            logger_1.default.info('Admediacards API Response', {
                status: response.status,
                url: response.config.url,
                data: response.data
            });
            return response;
        }, (error) => {
            logger_1.default.error('Admediacards Response Error', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            return Promise.reject(this.transformError(error));
        });
    }
    transformError(error) {
        const status = error.response?.status || 500;
        const data = error.response?.data;
        if (status === 401) {
            return new errors_1.AppError('UNAUTHORIZED', 'Invalid API credentials', 401);
        }
        else if (status === 403) {
            return new errors_1.AppError('FORBIDDEN', 'Access denied to this resource', 403);
        }
        else if (status === 404) {
            return new errors_1.AppError('NOT_FOUND', 'Resource not found', 404);
        }
        else if (status === 429) {
            return new errors_1.AppError('RATE_LIMIT', 'Too many requests, please try again later', 429);
        }
        else if (data?.Status === 1) {
            return new errors_1.AppError('API_ERROR', data.Message || 'Admediacards API error', 400);
        }
        return new errors_1.AppError('EXTERNAL_API_ERROR', 'Admediacards API error', status);
    }
    generateIdempotencyKey() {
        return (0, uuid_1.v4)();
    }
    // Test authentication
    async testAuth() {
        try {
            const response = await this.axios.get('/api/v1/open/test-auth');
            return response.data.Status === 0;
        }
        catch (error) {
            logger_1.default.error('Failed to test Admediacards auth', error);
            return false;
        }
    }
    // Account endpoints
    async getAccountBalance() {
        const response = await this.axios.get('/api/v1/open/account/balance');
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to get account balance');
        }
        return response.data.Result;
    }
    async getAccountProfile(cardLimit) {
        const params = cardLimit ? { cardlimit: cardLimit } : undefined;
        const response = await this.axios.get('/api/v1/open/account/profile', { params });
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to get account profile');
        }
        return response.data.Result;
    }
    async getPrograms() {
        const response = await this.axios.get('/api/v1/open/account/programs');
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to get programs');
        }
        return response.data.Result;
    }
    // Card endpoints
    async createCard(cardData, idempotencyKey) {
        // Check if we're in test mode and enforce card limit
        if (this.testMode) {
            const { data: activeCards, error } = await database_1.default
                .from('virtual_cards')
                .select('id')
                .eq('status', 'active')
                .not('admediacards_card_id', 'is', null);
            if (error) {
                logger_1.default.error('Failed to check active cards count', error);
            }
            else if (activeCards && activeCards.length >= this.maxTestCards) {
                throw new errors_1.AppError('TEST_MODE_LIMIT', `Cannot create more than ${this.maxTestCards} card(s) in test mode`, 400);
            }
        }
        const headers = {
            'Idempotency-Key': idempotencyKey || this.generateIdempotencyKey()
        };
        const response = await this.axios.post('/api/v1/open/cards', cardData, { headers });
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to create card');
        }
        return response.data;
    }
    async getCard(cardId) {
        const response = await this.axios.get(`/api/v1/open/cards/${cardId}`);
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to get card');
        }
        // API returns single card object
        const card = response.data.Result;
        if (!card) {
            throw new errors_1.AppError('NOT_FOUND', 'Card not found', 404);
        }
        return card;
    }
    async showPAN(cardId) {
        try {
            const response = await this.axios.get(`/api/v1/open/cards/${cardId}/showpan`);
            if (response.data.Status !== 0 || !response.data.Good) {
                throw new errors_1.AppError('EXTERNAL_API_ERROR', response.data.Result || 'Failed to get card PAN', 400);
            }
            return response.data.Result;
        }
        catch (error) {
            if (error instanceof axios_1.AxiosError) {
                logger_1.default.error('Admediacards showPAN API error', {
                    cardId,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                });
                if (error.response?.status === 404) {
                    throw new errors_1.AppError('NOT_FOUND', 'Card not found', 404);
                }
                throw new errors_1.AppError('EXTERNAL_API_ERROR', 'Failed to retrieve card details from provider', 500);
            }
            throw error;
        }
    }
    async listCards(params) {
        const response = await this.axios.get('/api/v1/open/cards', { params });
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to list cards');
        }
        return response.data;
    }
    async updateCard(cardId, updateData) {
        const response = await this.axios.put(`/api/v1/open/cards/${cardId}`, updateData);
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to update card');
        }
        return response.data;
    }
    async addCardNote(cardId, noteData) {
        const response = await this.axios.post(`/api/v1/open/cards/${cardId}/notes`, noteData, {
            headers: {
                'Idempotency-Key': this.generateIdempotencyKey()
            }
        });
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to add card note');
        }
    }
    // Transaction endpoints
    async listTransactions(params) {
        const response = await this.axios.get('/api/v1/open/transactions', { params });
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to list transactions');
        }
        return response.data;
    }
    async listCardTransactions(cardId) {
        const response = await this.axios.get(`/api/v1/open/cards/${cardId}/transactions`);
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to list card transactions');
        }
        return response.data.Result;
    }
    async listInternalTransactions(params) {
        const response = await this.axios.get('/api/v1/open/transactions/internal', { params });
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to list internal transactions');
        }
        return response.data;
    }
    // Webhook endpoints
    async listWebhooks() {
        const response = await this.axios.get('/api/v1/open/webhooks');
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to list webhooks');
        }
        return response.data.WebHooks;
    }
    async addWebhook(event, payloadUrl) {
        const response = await this.axios.post('/api/v1/open/webhooks', {
            Event: event,
            PayloadURL: payloadUrl
        }, {
            headers: {
                'Idempotency-Key': this.generateIdempotencyKey()
            }
        });
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to add webhook');
        }
    }
    async updateWebhook(webhookId, updates) {
        const response = await this.axios.put(`/api/v1/open/webhooks/${webhookId}`, updates);
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to update webhook');
        }
    }
    async deleteWebhook(webhookId) {
        const response = await this.axios.delete(`/api/v1/open/webhooks/${webhookId}`);
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to delete webhook');
        }
    }
    async getWebhookStats(webhookId) {
        const response = await this.axios.get(`/api/v1/open/webhooks/stats/${webhookId}`);
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to get webhook stats');
        }
        return response.data.WehookEvents;
    }
    async testWebhook(webhookId) {
        const response = await this.axios.post(`/api/v1/open/webhooks/test-post/${webhookId}`, {}, {
            headers: {
                'Idempotency-Key': this.generateIdempotencyKey()
            }
        });
        return response.data;
    }
    // Account endpoints
    async getMasterAccountBalance() {
        const response = await this.axios.get('/api/v1/open/account');
        if (response.data.Status !== 0) {
            throw new errors_1.AppError('API_ERROR', 'Failed to get master account balance');
        }
        return response.data.Result.PrepayBalance;
    }
    // Utility method to sync programs to database
    async syncProgramsToDatabase() {
        try {
            logger_1.default.info('Syncing Admediacards programs to database');
            // Get programs from API
            const programs = await this.getPrograms();
            // Get existing programs from database
            const { data: existingPrograms, error: fetchError } = await database_1.default
                .from('card_programs')
                .select('program_id');
            if (fetchError) {
                logger_1.default.error('Failed to fetch existing programs', fetchError);
                throw fetchError;
            }
            const existingIds = new Set(existingPrograms?.map(p => p.program_id) || []);
            const apiIds = new Set(programs.map(p => p.ProgramID));
            // Programs to insert (new ones from API)
            const programsToInsert = programs
                .filter(p => !existingIds.has(p.ProgramID))
                .map(p => ({
                program_id: p.ProgramID,
                bin: p.BIN,
                name: p.Name,
                is_active: true,
                date_entered_utc: p.DateEnteredUtc
            }));
            // Programs to update (existing ones)
            const programsToUpdate = programs.filter(p => existingIds.has(p.ProgramID));
            // Programs to deactivate (no longer in API)
            const idsToDeactivate = Array.from(existingIds).filter(id => !apiIds.has(id));
            // Insert new programs
            if (programsToInsert.length > 0) {
                const { error: insertError } = await database_1.default
                    .from('card_programs')
                    .insert(programsToInsert);
                if (insertError) {
                    logger_1.default.error('Failed to insert programs', insertError);
                    throw insertError;
                }
                logger_1.default.info(`Inserted ${programsToInsert.length} new programs`);
            }
            // Update existing programs
            for (const program of programsToUpdate) {
                const { error: updateError } = await database_1.default
                    .from('card_programs')
                    .update({
                    bin: program.BIN,
                    name: program.Name,
                    is_active: true,
                    updated_at: new Date().toISOString()
                })
                    .eq('program_id', program.ProgramID);
                if (updateError) {
                    logger_1.default.error(`Failed to update program ${program.ProgramID}`, updateError);
                }
            }
            if (programsToUpdate.length > 0) {
                logger_1.default.info(`Updated ${programsToUpdate.length} existing programs`);
            }
            // Deactivate programs no longer in API (instead of deleting)
            if (idsToDeactivate.length > 0) {
                const { error: deactivateError } = await database_1.default
                    .from('card_programs')
                    .update({ is_active: false, updated_at: new Date().toISOString() })
                    .in('program_id', idsToDeactivate);
                if (deactivateError) {
                    logger_1.default.error('Failed to deactivate programs', deactivateError);
                }
                else {
                    logger_1.default.info(`Deactivated ${idsToDeactivate.length} programs no longer in API`);
                }
            }
            logger_1.default.info(`Successfully synced ${programs.length} programs from API`);
        }
        catch (error) {
            logger_1.default.error('Failed to sync programs', error);
            throw error;
        }
    }
}
exports.AdmediacardsRealClient = AdmediacardsRealClient;
// Export singleton instance
exports.admediacardsClient = new AdmediacardsRealClient();
//# sourceMappingURL=realClient.js.map