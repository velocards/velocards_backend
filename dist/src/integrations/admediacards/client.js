"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdmediacardsClient = void 0;
exports.getAdmediacardsClient = getAdmediacardsClient;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../../utils/logger"));
const env_1 = require("../../config/env");
class AdmediacardsClient {
    apiKey;
    baseUrl;
    axiosInstance;
    isLive;
    // Mock data storage for realistic simulation
    mockCards = new Map();
    mockTransactions = new Map();
    mockAccount;
    mockProfile;
    mockPrograms;
    cardIdCounter = env_1.testConfig.cardIdStart;
    transactionIdCounter = env_1.testConfig.transactionIdStart;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.admediacards.com'; // Will be provided by account manager
        this.isLive = config.isLive || false;
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'Authorization': `ApiKey ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        // Initialize mock data
        this.initializeMockData();
        logger_1.default.info('Admediacards client initialized', {
            baseUrl: this.baseUrl,
            isLive: this.isLive,
            mode: this.isLive ? 'LIVE' : 'MOCK'
        });
    }
    initializeMockData() {
        // Mock account data
        this.mockAccount = {
            PrepayAmount: 50000.00,
            TotalSpend: 12345.67,
            FeesAmount: 567.89,
            PrepayBalance: 37086.44
        };
        // Mock profile data
        this.mockProfile = {
            PrepayThresholdEnum: 'Percent',
            PrepayThresholdValue: 100,
            CurrentBalance: 37086.44,
            AllowedCardLimit: 74172.88,
            FundRequired: 0,
            TotalCardBalance: 0,
            AutoApprovedLimit: 74172.88,
            CardNumberLimit: 500,
            ActiveCardNumber: 0,
            CardNumberLeft: 500,
            IsCardRequestAllowed: true,
            IsChangeRequestAllowed: true,
            XDaySpend: 234.56,
            XDayProjectedSpend: 456.78
        };
        // Mock programs
        this.mockPrograms = [
            {
                ProgramID: 1,
                BIN: env_1.testConfig.binMastercard,
                Name: 'DigiStreets-Mastercard',
                DateEnteredUtc: '2025-01-01T00:00:00.000Z'
            },
            {
                ProgramID: 2,
                BIN: env_1.testConfig.binVisa,
                Name: 'DigiStreets-Visa',
                DateEnteredUtc: '2025-01-01T00:00:00.000Z'
            }
        ];
    }
    /**
     * Test API authentication
     */
    async testAuth() {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get('/api/v1/open/test-auth');
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Admediacards auth test failed', { error });
                throw error;
            }
        }
        // Mock response
        return {
            Status: 0,
            Good: true,
            Result: {}
        };
    }
    /**
     * Get account balance
     */
    async getBalance() {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get('/api/v1/open/account/balance');
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to get Admediacards balance', { error });
                throw error;
            }
        }
        // Mock response
        return {
            Status: 0,
            Good: true,
            Result: this.mockAccount
        };
    }
    /**
     * Get account profile
     */
    async getProfile() {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get('/api/v1/open/account/profile');
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to get Admediacards profile', { error });
                throw error;
            }
        }
        // Mock response - update based on current cards
        const activeCards = Array.from(this.mockCards.values()).filter(card => card.IsActive);
        const totalCardBalance = activeCards.reduce((sum, card) => sum + card.Balance, 0);
        this.mockProfile.ActiveCardNumber = activeCards.length;
        this.mockProfile.CardNumberLeft = this.mockProfile.CardNumberLimit - activeCards.length;
        this.mockProfile.TotalCardBalance = totalCardBalance;
        this.mockProfile.AutoApprovedLimit = this.mockProfile.AllowedCardLimit - totalCardBalance;
        return {
            Status: 0,
            Good: true,
            Result: this.mockProfile
        };
    }
    /**
     * Get available programs
     */
    async getPrograms() {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get('/api/v1/open/account/programs');
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to get Admediacards programs', { error });
                throw error;
            }
        }
        // Mock response
        return {
            Status: 0,
            Good: true,
            Result: this.mockPrograms
        };
    }
    /**
     * Create a new card
     */
    async createCard(cardData, idempotencyKey) {
        const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.post('/api/v1/open/cards', cardData, { headers });
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to create Admediacards card', { error, cardData });
                throw error;
            }
        }
        // Mock card creation
        const cardId = this.cardIdCounter++;
        const last4 = Math.floor(1000 + Math.random() * 9000).toString();
        const program = this.mockPrograms.find(p => p.ProgramID === cardData.ProgramID) || this.mockPrograms[0];
        const newCard = {
            CardID: cardId,
            Name: `${cardData.FirstName} ${cardData.LastName}`,
            Limit: cardData.Limit,
            ProgramID: cardData.ProgramID,
            BIN: program.BIN,
            Last4: last4,
            Balance: cardData.Limit, // Start with full balance
            Address: `${cardData.Address1}, ${cardData.City}, ${cardData.State} ${cardData.Zip}`,
            IsActive: true,
            ClientNote: null,
            Currency: 'USD',
            ExpMonth: cardData.ExpMonth,
            ExpYear: cardData.ExpYear,
            Spend: 0,
            PhoneNumber: cardData.PhoneNumber,
            DateEnteredUtc: new Date().toISOString()
        };
        this.mockCards.set(cardId, newCard);
        // Update account balances
        this.mockAccount.TotalSpend += cardData.Limit; // Reserve the amount
        this.mockAccount.PrepayBalance -= cardData.Limit;
        logger_1.default.info('Mock card created', { cardId, limit: cardData.Limit });
        return {
            Status: 0,
            Good: true,
            Result: {
                IsApproved: true,
                CardID: cardId,
                ChangeRequestID: Math.floor(100000 + Math.random() * 900000)
            }
        };
    }
    /**
     * Get a specific card
     */
    async getCard(cardId) {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get(`/api/v1/open/cards/${cardId}`);
                const card = response.data.Result;
                if (!card) {
                    throw new Error('Card not found');
                }
                return card;
            }
            catch (error) {
                logger_1.default.error('Failed to get Admediacards card', { error, cardId });
                throw error;
            }
        }
        // Mock response
        const card = this.mockCards.get(cardId);
        if (!card) {
            throw new Error('Card not found');
        }
        return card;
    }
    /**
     * Get full card details including PAN and CVV
     */
    async showPAN(cardId) {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get(`/api/v1/open/cards/${cardId}/showpan`);
                const cardDetails = response.data.Result;
                if (!cardDetails) {
                    throw new Error('Card details not found');
                }
                return cardDetails;
            }
            catch (error) {
                logger_1.default.error('Failed to get Admediacards card PAN', { error, cardId });
                throw error;
            }
        }
        // Mock response - for development only, never expose real PAN in logs
        let card = this.mockCards.get(cardId);
        // If card not found in mock data, create a mock card from database info
        if (!card) {
            logger_1.default.info('Creating mock card data for existing card', { cardId });
            // Create mock card with realistic data for testing
            card = {
                CardID: cardId,
                Name: 'Test User',
                Limit: 100,
                ProgramID: 1,
                BIN: '552266', // Test Mastercard BIN
                Last4: '1298', // From database: ****1298
                Balance: 100,
                Address: '123 Test St, Test City, NY 10001',
                IsActive: true,
                ClientNote: `Mock card for testing | CardID: ${cardId}`,
                Currency: 'USD',
                ExpMonth: '6',
                ExpYear: '2028',
                Spend: 0,
                PhoneNumber: '+12125551234',
                DateEnteredUtc: new Date().toISOString()
            };
            // Add to mock cards for future requests
            this.mockCards.set(cardId, card);
        }
        // Generate mock full PAN for testing (16 digits)
        const mockPAN = `${card.BIN}${card.Last4.padStart(4, '0')}`;
        return {
            CardID: cardId,
            CcNum: mockPAN,
            Cvx2: '123', // Mock CVV - never log this in production
            ExpMonth: card.ExpMonth,
            ExpYear: card.ExpYear,
            // Legacy fields for compatibility
            PAN: mockPAN,
            CVV: '123'
        };
    }
    /**
     * List cards with pagination and search
     */
    async listCards(params) {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get('/api/v1/open/cards', { params });
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to list Admediacards cards', { error });
                throw error;
            }
        }
        // Mock response with pagination
        let cards = Array.from(this.mockCards.values());
        // Apply search if provided
        if (params?.search) {
            const searchTerm = params.search.toLowerCase();
            cards = cards.filter(card => card.Name.toLowerCase().includes(searchTerm) ||
                card.Last4.includes(searchTerm) ||
                card.Address.toLowerCase().includes(searchTerm));
        }
        // Apply sorting
        if (params?.sort_by) {
            const sortField = params.sort_by.replace('-', '');
            const isDesc = params.sort_by.startsWith('-');
            cards.sort((a, b) => {
                const aVal = a[sortField];
                const bVal = b[sortField];
                if (isDesc)
                    return bVal > aVal ? 1 : -1;
                return aVal > bVal ? 1 : -1;
            });
        }
        else {
            // Default sort by DateEnteredUtc descending
            cards.sort((a, b) => new Date(b.DateEnteredUtc).getTime() - new Date(a.DateEnteredUtc).getTime());
        }
        // Apply pagination
        const startIndex = params?.start_index || 0;
        const count = params?.count || 1000;
        const paginatedCards = cards.slice(startIndex, startIndex + count);
        return {
            Status: 0,
            Good: true,
            Result: paginatedCards,
            Metadata: {
                Count: paginatedCards.length,
                TotalCount: cards.length,
                TotalPages: Math.ceil(cards.length / count),
                StartIndex: startIndex,
                EndIndex: paginatedCards.length > 0 ? startIndex + paginatedCards.length - 1 : null,
                IsMore: startIndex + count < cards.length
            }
        };
    }
    /**
     * Update card (limits, status, address)
     */
    async updateCard(cardId, updateData, idempotencyKey) {
        const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.put(`/api/v1/open/cards/${cardId}`, updateData, { headers });
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to update Admediacards card', { error, cardId, updateData });
                throw error;
            }
        }
        // Mock update
        const card = this.mockCards.get(cardId);
        if (!card) {
            return {
                Status: 1,
                Good: false,
                Result: { IsApproved: false, ChangeRequestID: 0 }
            };
        }
        // Apply updates based on type
        switch (updateData.Type) {
            case 'Limit':
                if (updateData.Limit !== undefined) {
                    card.Limit = updateData.Limit;
                    card.Balance = card.Balance - card.Spend; // Recalculate balance
                }
                break;
            case 'Status':
                if (updateData.Status !== undefined) {
                    card.IsActive = updateData.Status;
                }
                break;
            case 'NameAddress':
                if (updateData.FirstName || updateData.LastName) {
                    card.Name = `${updateData.FirstName || card.Name.split(' ')[0]} ${updateData.LastName || card.Name.split(' ')[1] || ''}`;
                }
                if (updateData.Address1 || updateData.City || updateData.State || updateData.Zip) {
                    const addressParts = card.Address.split(', ');
                    card.Address = `${updateData.Address1 || addressParts[0]}, ${updateData.City || addressParts[1]}, ${updateData.State || addressParts[2]?.split(' ')[0]} ${updateData.Zip || addressParts[2]?.split(' ')[1]}`;
                }
                break;
        }
        this.mockCards.set(cardId, card);
        logger_1.default.info('Mock card updated', { cardId, type: updateData.Type });
        return {
            Status: 0,
            Good: true,
            Result: {
                IsApproved: true,
                ChangeRequestID: Math.floor(100000 + Math.random() * 900000)
            }
        };
    }
    /**
     * Add a note to a card
     */
    async addCardNote(cardId, noteData) {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.post(`/api/v1/open/cards/${cardId}/notes`, noteData, {
                    headers: {
                        'Idempotency-Key': this.generateIdempotencyKey()
                    }
                });
                if (response.data.Status !== 0) {
                    throw new Error('Failed to add card note');
                }
                return;
            }
            catch (error) {
                logger_1.default.error('Failed to add card note', { error });
                throw error;
            }
        }
        // Mock implementation - just log the note
        logger_1.default.info('Mock card note added', { cardId, note: noteData.Note });
    }
    /**
     * Get transactions
     */
    async getTransactions(params) {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get('/api/v1/open/transactions', { params });
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to get Admediacards transactions', { error });
                throw error;
            }
        }
        // Mock response
        let transactions = Array.from(this.mockTransactions.values());
        // Apply date filtering
        if (params?.tx_date_from_utc) {
            const fromDate = new Date(params.tx_date_from_utc).getTime() / 1000;
            transactions = transactions.filter(tx => tx.TxDateTimeIso >= fromDate);
        }
        if (params?.tx_date_to_utc) {
            const toDate = new Date(params.tx_date_to_utc).getTime() / 1000;
            transactions = transactions.filter(tx => tx.TxDateTimeIso <= toDate);
        }
        // Apply search
        if (params?.search) {
            const searchTerm = params.search.toLowerCase();
            transactions = transactions.filter(tx => tx.Merchant.toLowerCase().includes(searchTerm) ||
                tx.Amount.toString().includes(searchTerm));
        }
        // Apply sorting
        if (params?.sort_by) {
            const sortField = params.sort_by.replace('-', '');
            const isDesc = params.sort_by.startsWith('-');
            transactions.sort((a, b) => {
                const aVal = a[sortField];
                const bVal = b[sortField];
                if (isDesc)
                    return bVal > aVal ? 1 : -1;
                return aVal > bVal ? 1 : -1;
            });
        }
        else {
            // Default sort by TransactionDateTime descending
            transactions.sort((a, b) => b.TxDateTimeIso - a.TxDateTimeIso);
        }
        // Apply pagination
        const startIndex = params?.start_index || 0;
        const count = params?.count || 1000;
        const paginatedTx = transactions.slice(startIndex, startIndex + count);
        return {
            Status: 0,
            Good: true,
            Result: paginatedTx,
            Metadata: {
                Count: paginatedTx.length,
                TotalCount: transactions.length,
                TotalPages: Math.ceil(transactions.length / count),
                StartIndex: startIndex,
                EndIndex: paginatedTx.length > 0 ? startIndex + paginatedTx.length - 1 : null,
                IsMore: startIndex + count < transactions.length
            }
        };
    }
    /**
     * Get card transactions
     */
    async getCardTransactions(cardId) {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get(`/api/v1/open/cards/${cardId}/transactions`);
                return response.data;
            }
            catch (error) {
                logger_1.default.error('Failed to get card transactions', { error, cardId });
                throw error;
            }
        }
        // Mock response
        const cardTransactions = Array.from(this.mockTransactions.values())
            .filter(tx => tx.CardID === cardId)
            .sort((a, b) => b.TxDateTimeIso - a.TxDateTimeIso);
        return {
            Status: 0,
            Good: true,
            Result: cardTransactions
        };
    }
    /**
     * Simulate a transaction (for testing)
     */
    async simulateTransaction(params) {
        if (this.isLive) {
            throw new Error('Cannot simulate transactions on live API');
        }
        const card = this.mockCards.get(params.cardId);
        if (!card) {
            throw new Error('Card not found');
        }
        const transactionId = this.transactionIdCounter++;
        const isApproved = params.isApproved !== false && card.IsActive && card.Balance >= params.amount;
        const transaction = {
            TransactionID: transactionId,
            ParentTransactionID: null,
            CardID: params.cardId,
            Response: isApproved ? 'approved' : 'declined',
            ResponseText: isApproved ? 'Approved' : (card.Balance < params.amount ? 'Insufficient funds' : 'Card not active'),
            Merchant: params.merchant,
            Amount: params.amount,
            TxDateTimeIso: Math.floor(Date.now() / 1000),
            TypeEnum: 'Authorization',
            IsTemp: true,
            Country: params.country || 'US'
        };
        this.mockTransactions.set(transactionId, transaction);
        // Update card balance if approved
        if (isApproved) {
            card.Balance -= params.amount;
            card.Spend += params.amount;
            this.mockCards.set(params.cardId, card);
        }
        logger_1.default.info('Mock transaction created', { transactionId, cardId: params.cardId, amount: params.amount, approved: isApproved });
        return transaction;
    }
    /**
     * Simulate webhook (for testing)
     */
    simulateWebhook(type, data) {
        if (this.isLive) {
            throw new Error('Cannot simulate webhooks on live API');
        }
        logger_1.default.info('Simulating Admediacards webhook', { type, data });
        return data;
    }
    /**
     * Get master account balance
     * This is the total balance for our entire platform, not individual users
     */
    async getMasterAccountBalance() {
        if (this.isLive) {
            try {
                const response = await this.axiosInstance.get('/api/v1/open/account/balance');
                return response.data.Result.PrepayBalance;
            }
            catch (error) {
                logger_1.default.error('Failed to get master account balance', { error });
                throw error;
            }
        }
        // Mock implementation
        return this.mockAccount.PrepayBalance;
    }
    /**
     * Generate idempotency key for API requests
     */
    generateIdempotencyKey() {
        return `key_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
}
exports.AdmediacardsClient = AdmediacardsClient;
// Export singleton instance for easy access
let admediacardsClient = null;
function getAdmediacardsClient() {
    if (!admediacardsClient) {
        const mockExternalApis = process.env['MOCK_EXTERNAL_APIS'] === 'true';
        const hasApiKey = !!process.env['ADMEDIACARDS_API_KEY'];
        admediacardsClient = new AdmediacardsClient({
            apiKey: process.env['ADMEDIACARDS_API_KEY'] || 'mock_api_key',
            baseUrl: process.env['ADMEDIACARDS_BASE_URL'] || 'https://openapi.admediacards.com',
            isLive: !mockExternalApis && hasApiKey
        });
    }
    return admediacardsClient;
}
//# sourceMappingURL=client.js.map