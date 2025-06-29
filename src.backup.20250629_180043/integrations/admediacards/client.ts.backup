import axios, { AxiosInstance } from 'axios';
import logger from '../../utils/logger';
import { testConfig } from '../../config/env';

// Admediacards API Types (based on their documentation)
export interface AdmediacardsAccount {
  PrepayAmount: number;
  TotalSpend: number;
  FeesAmount: number;
  PrepayBalance: number;
}

export interface AdmediacardsProfile {
  PrepayThresholdEnum: 'Percent' | 'Flat';
  PrepayThresholdValue: number;
  CurrentBalance: number;
  AllowedCardLimit: number;
  FundRequired: number;
  TotalCardBalance: number;
  AutoApprovedLimit: number;
  CardNumberLimit: number;
  ActiveCardNumber: number;
  CardNumberLeft: number;
  IsCardRequestAllowed: boolean;
  IsChangeRequestAllowed: boolean;
  XDaySpend: number;
  XDayProjectedSpend: number;
}

export interface AdmediacardsProgram {
  ProgramID: number;
  BIN: string;
  Name: string;
  DateEnteredUtc: string;
}

export interface AdmediacardsCard {
  CardID: number;
  Name: string;
  Limit: number;
  ProgramID: number;
  BIN: string;
  Last4: string;
  Balance: number;
  Address: string;
  IsActive: boolean;
  ClientNote: string | null;
  Currency: string;
  ExpMonth: string;
  ExpYear: string;
  Spend: number;
  PhoneNumber: string;
  DateEnteredUtc: string;
}

export interface AdmediacardsTransaction {
  TransactionID: number;
  ParentTransactionID: number | null;
  CardID: number;
  Response: 'approved' | 'declined';
  ResponseText: string;
  Merchant: string;
  Amount: number;
  TxDateTimeIso: number;
  TypeEnum: 'Authorization' | 'Settlement' | 'Refund';
  IsTemp: boolean;
  Country: string;
}

export interface AdmediacardsResponse<T> {
  Status: number; // 0 = success, 1 = error
  Good: boolean;
  Result: T;
  Metadata?: {
    Count: number;
    TotalCount: number;
    TotalPages: number;
    StartIndex: number;
    EndIndex: number | null;
    IsMore: boolean;
  };
}

export interface CreateCardRequest {
  ProgramID: number;
  Limit: number;
  FirstName: string;
  LastName: string;
  Address1: string;
  City: string;
  State: string;
  Zip: string;
  CountryIso: string;
  ExpMonth: string;
  ExpYear: string;
  PhoneNumber: string;
}

export interface CreateCardResponse {
  IsApproved: boolean;
  CardID: number;
  ChangeRequestID: number;
}

export interface UpdateCardRequest {
  Type: 'Limit' | 'NameAddress' | 'Status';
  Limit?: number;
  Status?: boolean;
  FirstName?: string;
  LastName?: string;
  Address1?: string;
  City?: string;
  State?: string;
  Country?: string;
  Zip?: string;
}

export interface AddCardNoteRequest {
  Note: string;
}

export interface AdmediacardsInternalTransaction {
  TransactionID: number;
  CardID: number | null;
  TypeEnum: 'Wire' | 'Fee';
  Amount: number;
  TransactionDate: number;
  Description: string;
  DateEnteredUtc: number;
}

export interface AdmediacardsWebhook {
  WebHookID: number;
  PayloadURL: string;
  FailedAttempts: number;
  NextRunUtc: number | null;
  IsActive: boolean;
  Event: WebhookEvent;
}

export type WebhookEvent = 'CardAdded' | 'InternalTransactionAdded' | 'TransactionAdded';

export interface AdmediacardsWebhookPayload {
  // CardAdded
  CardID?: number;
  Limit?: number;
  BIN?: string;
  Last4?: string;
  FirstName?: string;
  LastName?: string;
  Address1?: string;
  City?: string;
  State?: string;
  Zip?: string;
  CountryIso?: string;
  ExpMonth?: string;
  ExpYear?: string;
  
  // TransactionAdded  
  Balance?: number;
  TransactionID?: number;
  Amount?: number;
  LocalAmount?: number;
  LocalCurrency?: string;
  Merchant?: string;
  Country?: string;
  TransactionDateTime?: string;
  Response?: string;
  ResponseText?: string;
  IsTemp?: boolean;
  TypeEnum?: string;
}

export class AdmediacardsClient {
  private apiKey: string;
  private baseUrl: string;
  private axiosInstance: AxiosInstance;
  private isLive: boolean;

  // Mock data storage for realistic simulation
  private mockCards: Map<number, AdmediacardsCard> = new Map();
  private mockTransactions: Map<number, AdmediacardsTransaction> = new Map();
  private mockAccount!: AdmediacardsAccount;
  private mockProfile!: AdmediacardsProfile;
  private mockPrograms!: AdmediacardsProgram[];
  private cardIdCounter = testConfig.cardIdStart;
  private transactionIdCounter = testConfig.transactionIdStart;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    isLive?: boolean;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.admediacards.com'; // Will be provided by account manager
    this.isLive = config.isLive || false;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Initialize mock data
    this.initializeMockData();

    logger.info('Admediacards client initialized', {
      baseUrl: this.baseUrl,
      isLive: this.isLive,
      mode: this.isLive ? 'LIVE' : 'MOCK'
    });
  }

  private initializeMockData() {
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
        BIN: testConfig.binMastercard,
        Name: 'DigiStreets-Mastercard',
        DateEnteredUtc: '2025-01-01T00:00:00.000Z'
      },
      {
        ProgramID: 2,
        BIN: testConfig.binVisa,
        Name: 'DigiStreets-Visa',
        DateEnteredUtc: '2025-01-01T00:00:00.000Z'
      }
    ];
  }

  /**
   * Test API authentication
   */
  async testAuth(): Promise<AdmediacardsResponse<{}>> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get('/api/v1/open/test-auth');
        return response.data;
      } catch (error) {
        logger.error('Admediacards auth test failed', { error });
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
  async getBalance(): Promise<AdmediacardsResponse<AdmediacardsAccount>> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get('/api/v1/open/account/balance');
        return response.data;
      } catch (error) {
        logger.error('Failed to get Admediacards balance', { error });
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
  async getProfile(): Promise<AdmediacardsResponse<AdmediacardsProfile>> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get('/api/v1/open/account/profile');
        return response.data;
      } catch (error) {
        logger.error('Failed to get Admediacards profile', { error });
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
  async getPrograms(): Promise<AdmediacardsResponse<AdmediacardsProgram[]>> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get('/api/v1/open/account/programs');
        return response.data;
      } catch (error) {
        logger.error('Failed to get Admediacards programs', { error });
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
  async createCard(
    cardData: CreateCardRequest,
    idempotencyKey?: string
  ): Promise<AdmediacardsResponse<CreateCardResponse>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};

    if (this.isLive) {
      try {
        const response = await this.axiosInstance.post('/api/v1/open/cards', cardData, { headers });
        return response.data;
      } catch (error) {
        logger.error('Failed to create Admediacards card', { error, cardData });
        throw error;
      }
    }

    // Mock card creation
    const cardId = this.cardIdCounter++;
    const last4 = Math.floor(1000 + Math.random() * 9000).toString();
    const program = this.mockPrograms.find(p => p.ProgramID === cardData.ProgramID) || this.mockPrograms[0]!;
    
    const newCard: AdmediacardsCard = {
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

    logger.info('Mock card created', { cardId, limit: cardData.Limit });

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
  async getCard(cardId: number): Promise<AdmediacardsCard> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get(`/api/v1/open/cards/${cardId}`);
        const card = response.data.Result;
        if (!card) {
          throw new Error('Card not found');
        }
        return card;
      } catch (error) {
        logger.error('Failed to get Admediacards card', { error, cardId });
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
   * List cards with pagination and search
   */
  async listCards(params?: {
    search?: string;
    search_fields?: string;
    sort_by?: string;
    start_index?: number;
    count?: number;
  }): Promise<AdmediacardsResponse<AdmediacardsCard[]>> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get('/api/v1/open/cards', { params });
        return response.data;
      } catch (error) {
        logger.error('Failed to list Admediacards cards', { error });
        throw error;
      }
    }

    // Mock response with pagination
    let cards = Array.from(this.mockCards.values());
    
    // Apply search if provided
    if (params?.search) {
      const searchTerm = params.search.toLowerCase();
      cards = cards.filter(card => 
        card.Name.toLowerCase().includes(searchTerm) ||
        card.Last4.includes(searchTerm) ||
        card.Address.toLowerCase().includes(searchTerm)
      );
    }

    // Apply sorting
    if (params?.sort_by) {
      const sortField = params.sort_by.replace('-', '');
      const isDesc = params.sort_by.startsWith('-');
      cards.sort((a, b) => {
        const aVal = (a as any)[sortField];
        const bVal = (b as any)[sortField];
        if (isDesc) return bVal > aVal ? 1 : -1;
        return aVal > bVal ? 1 : -1;
      });
    } else {
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
  async updateCard(
    cardId: number,
    updateData: UpdateCardRequest,
    idempotencyKey?: string
  ): Promise<AdmediacardsResponse<{ IsApproved: boolean; ChangeRequestID: number }>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {};

    if (this.isLive) {
      try {
        const response = await this.axiosInstance.put(`/api/v1/open/cards/${cardId}`, updateData, { headers });
        return response.data;
      } catch (error) {
        logger.error('Failed to update Admediacards card', { error, cardId, updateData });
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

    logger.info('Mock card updated', { cardId, type: updateData.Type });

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
  async addCardNote(cardId: number, noteData: AddCardNoteRequest): Promise<void> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.post(
          `/api/v1/open/cards/${cardId}/notes`,
          noteData,
          {
            headers: {
              'Idempotency-Key': this.generateIdempotencyKey()
            }
          }
        );
        if (response.data.Status !== 0) {
          throw new Error('Failed to add card note');
        }
        return;
      } catch (error) {
        logger.error('Failed to add card note', { error });
        throw error;
      }
    }

    // Mock implementation - just log the note
    logger.info('Mock card note added', { cardId, note: noteData.Note });
  }

  /**
   * Get transactions
   */
  async getTransactions(params?: {
    tx_date_from_utc?: string;
    tx_date_to_utc?: string;
    search?: string;
    sort_by?: string;
    start_index?: number;
    count?: number;
  }): Promise<AdmediacardsResponse<AdmediacardsTransaction[]>> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get('/api/v1/open/transactions', { params });
        return response.data;
      } catch (error) {
        logger.error('Failed to get Admediacards transactions', { error });
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
      transactions = transactions.filter(tx => 
        tx.Merchant.toLowerCase().includes(searchTerm) ||
        tx.Amount.toString().includes(searchTerm)
      );
    }

    // Apply sorting
    if (params?.sort_by) {
      const sortField = params.sort_by.replace('-', '');
      const isDesc = params.sort_by.startsWith('-');
      transactions.sort((a, b) => {
        const aVal = (a as any)[sortField];
        const bVal = (b as any)[sortField];
        if (isDesc) return bVal > aVal ? 1 : -1;
        return aVal > bVal ? 1 : -1;
      });
    } else {
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
  async getCardTransactions(cardId: number): Promise<AdmediacardsResponse<AdmediacardsTransaction[]>> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get(`/api/v1/open/cards/${cardId}/transactions`);
        return response.data;
      } catch (error) {
        logger.error('Failed to get card transactions', { error, cardId });
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
  async simulateTransaction(params: {
    cardId: number;
    amount: number;
    merchant: string;
    country?: string;
    isApproved?: boolean;
  }): Promise<AdmediacardsTransaction> {
    if (this.isLive) {
      throw new Error('Cannot simulate transactions on live API');
    }

    const card = this.mockCards.get(params.cardId);
    if (!card) {
      throw new Error('Card not found');
    }

    const transactionId = this.transactionIdCounter++;
    const isApproved = params.isApproved !== false && card.IsActive && card.Balance >= params.amount;

    const transaction: AdmediacardsTransaction = {
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

    logger.info('Mock transaction created', { transactionId, cardId: params.cardId, amount: params.amount, approved: isApproved });

    return transaction;
  }

  /**
   * Simulate webhook (for testing)
   */
  simulateWebhook(type: 'CardAdded' | 'TransactionAdded', data: AdmediacardsWebhookPayload): AdmediacardsWebhookPayload {
    if (this.isLive) {
      throw new Error('Cannot simulate webhooks on live API');
    }

    logger.info('Simulating Admediacards webhook', { type, data });
    return data;
  }

  /**
   * Get master account balance
   * This is the total balance for our entire platform, not individual users
   */
  async getMasterAccountBalance(): Promise<number> {
    if (this.isLive) {
      try {
        const response = await this.axiosInstance.get('/api/v1/open/account/balance');
        return response.data.Result.PrepayBalance;
      } catch (error) {
        logger.error('Failed to get master account balance', { error });
        throw error;
      }
    }

    // Mock implementation
    return this.mockAccount.PrepayBalance;
  }

  /**
   * Generate idempotency key for API requests
   */
  private generateIdempotencyKey(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

// Export singleton instance for easy access
let admediacardsClient: AdmediacardsClient | null = null;

export function getAdmediacardsClient(): AdmediacardsClient {
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