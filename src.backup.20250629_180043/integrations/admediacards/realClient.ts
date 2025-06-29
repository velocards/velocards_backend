import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { admediacards as admediacardsConfig } from '../../config/env';
import supabase from '../../config/database';

// Import types from the existing client file
import {
  AdmediacardsAccount,
  AdmediacardsProfile,
  AdmediacardsProgram,
  AdmediacardsCard,
  AdmediacardsShowPAN,
  AdmediacardsTransaction,
  AdmediacardsResponse,
  CreateCardRequest,
  CreateCardResponse,
  UpdateCardRequest,
  AddCardNoteRequest,
  AdmediacardsInternalTransaction,
  AdmediacardsWebhook,
  WebhookEvent
} from './client';

export class AdmediacardsRealClient {
  private axios: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private testMode: boolean;
  private maxTestCards: number;
  // @ts-ignore - Will be used for master account operations
  private accountId: string;

  constructor() {
    this.apiKey = admediacardsConfig.apiKey;
    this.baseUrl = admediacardsConfig.baseUrl;
    this.testMode = admediacardsConfig.testMode;
    this.maxTestCards = admediacardsConfig.maxTestCards;
    this.accountId = admediacardsConfig.accountId;

    // Create axios instance with default config
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `ApiKey ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.axios.interceptors.request.use(
      (config) => {
        logger.info('Admediacards API Request', {
          method: config.method,
          url: config.url,
          params: config.params,
          data: config.data
        });
        return config;
      },
      (error) => {
        logger.error('Admediacards Request Error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.axios.interceptors.response.use(
      (response) => {
        logger.info('Admediacards API Response', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      (error: AxiosError) => {
        logger.error('Admediacards Response Error', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(this.transformError(error));
      }
    );
  }

  private transformError(error: AxiosError): AppError {
    const status = error.response?.status || 500;
    const data = error.response?.data as any;
    
    if (status === 401) {
      return new AppError('UNAUTHORIZED', 'Invalid API credentials', 401);
    } else if (status === 403) {
      return new AppError('FORBIDDEN', 'Access denied to this resource', 403);
    } else if (status === 404) {
      return new AppError('NOT_FOUND', 'Resource not found', 404);
    } else if (status === 429) {
      return new AppError('RATE_LIMIT', 'Too many requests, please try again later', 429);
    } else if (data?.Status === 1) {
      return new AppError('API_ERROR', data.Message || 'Admediacards API error', 400);
    }
    
    return new AppError('EXTERNAL_API_ERROR', 'Admediacards API error', status);
  }

  private generateIdempotencyKey(): string {
    return uuidv4();
  }

  // Test authentication
  async testAuth(): Promise<boolean> {
    try {
      const response = await this.axios.get<AdmediacardsResponse<void>>('/api/v1/open/test-auth');
      return response.data.Status === 0;
    } catch (error) {
      logger.error('Failed to test Admediacards auth', error);
      return false;
    }
  }

  // Account endpoints
  async getAccountBalance(): Promise<AdmediacardsAccount> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsAccount>>(
      '/api/v1/open/account/balance'
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to get account balance');
    }
    
    return response.data.Result;
  }

  async getAccountProfile(cardLimit?: number): Promise<AdmediacardsProfile> {
    const params = cardLimit ? { cardlimit: cardLimit } : undefined;
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsProfile>>(
      '/api/v1/open/account/profile',
      { params }
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to get account profile');
    }
    
    return response.data.Result;
  }

  async getPrograms(): Promise<AdmediacardsProgram[]> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsProgram[]>>(
      '/api/v1/open/account/programs'
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to get programs');
    }
    
    return response.data.Result;
  }

  // Card endpoints
  async createCard(cardData: CreateCardRequest, idempotencyKey?: string): Promise<AdmediacardsResponse<CreateCardResponse>> {
    // Check if we're in test mode and enforce card limit
    if (this.testMode) {
      const { data: activeCards, error } = await supabase
        .from('virtual_cards')
        .select('id')
        .eq('status', 'active')
        .not('admediacards_card_id', 'is', null);
      
      if (error) {
        logger.error('Failed to check active cards count', error);
      } else if (activeCards && activeCards.length >= this.maxTestCards) {
        throw new AppError(
          'TEST_MODE_LIMIT',
          `Cannot create more than ${this.maxTestCards} card(s) in test mode`,
          400
        );
      }
    }

    const headers: any = {
      'Idempotency-Key': idempotencyKey || this.generateIdempotencyKey()
    };

    const response = await this.axios.post<AdmediacardsResponse<CreateCardResponse>>(
      '/api/v1/open/cards',
      cardData,
      { headers }
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to create card');
    }
    
    return response.data;
  }

  async getCard(cardId: number): Promise<AdmediacardsCard> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsCard>>(
      `/api/v1/open/cards/${cardId}`
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to get card');
    }
    
    // API returns single card object
    const card = response.data.Result;
    if (!card) {
      throw new AppError('NOT_FOUND', 'Card not found', 404);
    }
    
    return card;
  }

  async showPAN(cardId: number): Promise<AdmediacardsShowPAN> {
    try {
      const response = await this.axios.get(`/api/v1/open/cards/${cardId}/showpan`);
      
      if (response.data.Status !== 0 || !response.data.Good) {
        throw new AppError('EXTERNAL_API_ERROR', response.data.Result || 'Failed to get card PAN', 400);
      }
      
      return response.data.Result;
    } catch (error) {
      if (error instanceof AxiosError) {
        logger.error('Admediacards showPAN API error', {
          cardId,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        
        if (error.response?.status === 404) {
          throw new AppError('NOT_FOUND', 'Card not found', 404);
        }
        
        throw new AppError('EXTERNAL_API_ERROR', 'Failed to retrieve card details from provider', 500);
      }
      
      throw error;
    }
  }

  async listCards(params?: {
    search?: string;
    search_fields?: string;
    sort_by?: string;
    start_index?: number;
    count?: number;
  }): Promise<AdmediacardsResponse<AdmediacardsCard[]>> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsCard[]>>(
      '/api/v1/open/cards',
      { params }
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to list cards');
    }
    
    return response.data;
  }

  async updateCard(cardId: number, updateData: UpdateCardRequest): Promise<AdmediacardsResponse<{ IsApproved: boolean; ChangeRequestID: number }>> {
    const response = await this.axios.put<AdmediacardsResponse<{ IsApproved: boolean; ChangeRequestID: number }>>(
      `/api/v1/open/cards/${cardId}`,
      updateData
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to update card');
    }
    
    return response.data;
  }

  async addCardNote(cardId: number, noteData: AddCardNoteRequest): Promise<void> {
    const response = await this.axios.post<AdmediacardsResponse<void>>(
      `/api/v1/open/cards/${cardId}/notes`,
      noteData,
      {
        headers: {
          'Idempotency-Key': this.generateIdempotencyKey()
        }
      }
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to add card note');
    }
  }

  // Transaction endpoints
  async listTransactions(params?: {
    search?: string;
    search_fields?: string;
    sort_by?: string;
    start_index?: number;
    count?: number;
    tx_date_from_utc?: string;
    tx_date_to_utc?: string;
  }): Promise<AdmediacardsResponse<AdmediacardsTransaction[]>> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsTransaction[]>>(
      '/api/v1/open/transactions',
      { params }
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to list transactions');
    }
    
    return response.data;
  }

  async listCardTransactions(cardId: number): Promise<AdmediacardsTransaction[]> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsTransaction[]>>(
      `/api/v1/open/cards/${cardId}/transactions`
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to list card transactions');
    }
    
    return response.data.Result;
  }

  async listInternalTransactions(params?: {
    search?: string;
    sort_by?: string;
    start_index?: number;
    count?: number;
  }): Promise<AdmediacardsResponse<AdmediacardsInternalTransaction[]>> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsInternalTransaction[]>>(
      '/api/v1/open/transactions/internal',
      { params }
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to list internal transactions');
    }
    
    return response.data;
  }

  // Webhook endpoints
  async listWebhooks(): Promise<AdmediacardsWebhook[]> {
    const response = await this.axios.get<{ Status: number; WebHooks: AdmediacardsWebhook[] }>(
      '/api/v1/open/webhooks'
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to list webhooks');
    }
    
    return response.data.WebHooks;
  }

  async addWebhook(event: WebhookEvent, payloadUrl: string): Promise<void> {
    const response = await this.axios.post<AdmediacardsResponse<void>>(
      '/api/v1/open/webhooks',
      {
        Event: event,
        PayloadURL: payloadUrl
      },
      {
        headers: {
          'Idempotency-Key': this.generateIdempotencyKey()
        }
      }
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to add webhook');
    }
  }

  async updateWebhook(webhookId: number, updates: {
    PayloadURL?: string;
    IsActive?: boolean;
    FailedAttempts?: number;
  }): Promise<void> {
    const response = await this.axios.put<AdmediacardsResponse<void>>(
      `/api/v1/open/webhooks/${webhookId}`,
      updates
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to update webhook');
    }
  }

  async deleteWebhook(webhookId: number): Promise<void> {
    const response = await this.axios.delete<AdmediacardsResponse<void>>(
      `/api/v1/open/webhooks/${webhookId}`
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to delete webhook');
    }
  }

  async getWebhookStats(webhookId: number): Promise<any> {
    const response = await this.axios.get<any>(
      `/api/v1/open/webhooks/stats/${webhookId}`
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to get webhook stats');
    }
    
    return response.data.WehookEvents;
  }

  async testWebhook(webhookId: number): Promise<any> {
    const response = await this.axios.post<any>(
      `/api/v1/open/webhooks/test-post/${webhookId}`,
      {},
      {
        headers: {
          'Idempotency-Key': this.generateIdempotencyKey()
        }
      }
    );
    
    return response.data;
  }

  // Account endpoints
  async getMasterAccountBalance(): Promise<number> {
    const response = await this.axios.get<AdmediacardsResponse<AdmediacardsAccount>>(
      '/api/v1/open/account'
    );
    
    if (response.data.Status !== 0) {
      throw new AppError('API_ERROR', 'Failed to get master account balance');
    }
    
    return response.data.Result.PrepayBalance;
  }

  // Utility method to sync programs to database
  async syncProgramsToDatabase(): Promise<void> {
    try {
      logger.info('Syncing Admediacards programs to database');
      
      // Get programs from API
      const programs = await this.getPrograms();
      
      // Get existing programs from database
      const { data: existingPrograms, error: fetchError } = await supabase
        .from('card_programs')
        .select('program_id');
      
      if (fetchError) {
        logger.error('Failed to fetch existing programs', fetchError);
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
        const { error: insertError } = await supabase
          .from('card_programs')
          .insert(programsToInsert);
        
        if (insertError) {
          logger.error('Failed to insert programs', insertError);
          throw insertError;
        }
        logger.info(`Inserted ${programsToInsert.length} new programs`);
      }
      
      // Update existing programs
      for (const program of programsToUpdate) {
        const { error: updateError } = await supabase
          .from('card_programs')
          .update({
            bin: program.BIN,
            name: program.Name,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('program_id', program.ProgramID);
        
        if (updateError) {
          logger.error(`Failed to update program ${program.ProgramID}`, updateError);
        }
      }
      if (programsToUpdate.length > 0) {
        logger.info(`Updated ${programsToUpdate.length} existing programs`);
      }
      
      // Deactivate programs no longer in API (instead of deleting)
      if (idsToDeactivate.length > 0) {
        const { error: deactivateError } = await supabase
          .from('card_programs')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('program_id', idsToDeactivate);
        
        if (deactivateError) {
          logger.error('Failed to deactivate programs', deactivateError);
        } else {
          logger.info(`Deactivated ${idsToDeactivate.length} programs no longer in API`);
        }
      }
      
      logger.info(`Successfully synced ${programs.length} programs from API`);
    } catch (error) {
      logger.error('Failed to sync programs', error);
      throw error;
    }
  }
}

// Export singleton instance
export const admediacardsClient = new AdmediacardsRealClient();