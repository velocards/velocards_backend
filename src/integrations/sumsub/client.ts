import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import logger from '../../utils/logger';
import { kyc as kycConfig } from '../../config/env';

export interface SumsubApplicantData {
  id: string;
  externalUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  review?: {
    reviewResult?: {
      reviewAnswer: 'GREEN' | 'RED' | 'RETRY';
    };
    reviewStatus: 'init' | 'pending' | 'prechecked' | 'queued' | 'completed';
    moderationComment?: string;
    rejectLabels?: string[];
  };
  createdAt: string;
  type: string;
}

export interface SumsubAccessToken {
  token: string;
  userId: string;
}

export interface WebhookPayload {
  applicantId: string;
  externalUserId: string;
  type: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer: 'GREEN' | 'RED' | 'RETRY';
  };
  createdAt: string;
}

export class SumsubClient {
  private appToken: string;
  private secretKey: string;
  private baseUrl: string;
  private axiosInstance: AxiosInstance;
  private levelName: string;

  constructor(config?: {
    appToken?: string;
    secretKey?: string;
    baseUrl?: string;
    levelName?: string;
  }) {
    this.appToken = config?.appToken || kycConfig.apiKey;
    this.secretKey = config?.secretKey || kycConfig.secretKey;
    // For now, always use the main API URL - Sumsub uses the same URL for sandbox
    this.baseUrl = config?.baseUrl || kycConfig.apiUrl;
    this.levelName = config?.levelName || 'id-and-liveness';
    
    logger.debug('Sumsub client initialized', {
      baseUrl: this.baseUrl,
      levelName: this.levelName,
      appTokenPrefix: this.appToken.substring(0, 10) + '...'
    });

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Sumsub API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: {
            'X-App-Token': config.headers?.['X-App-Token'] ? 'present' : 'missing',
          }
        });
        return config;
      },
      (error) => {
        logger.error('Sumsub API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('Sumsub API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Sumsub API Response Error', {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate HMAC signature for request
   */
  private generateSignature(
    method: string,
    url: string,
    timestamp: number,
    body?: any
  ): string {
    const data = timestamp + method.toUpperCase() + url;
    const bodyStr = body ? JSON.stringify(body) : '';
    
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(data + bodyStr)
      .digest('hex');
  }

  /**
   * Create authorization headers
   */
  private createAuthHeaders(
    method: string,
    url: string,
    body?: any
  ): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(method, url, timestamp, body);

    return {
      'X-App-Token': this.appToken,
      'X-App-Access-Ts': timestamp.toString(),
      'X-App-Access-Sig': signature,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create or update applicant
   */
  async createApplicant(
    externalUserId: string,
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<SumsubApplicantData> {
    const url = `/resources/applicants?levelName=${this.levelName}`;
    const body = {
      externalUserId,
      email,
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
    };

    const headers = this.createAuthHeaders('POST', url, body);

    try {
      const response = await this.axiosInstance.post<SumsubApplicantData>(
        url,
        body,
        { headers }
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 409) {
        // Applicant already exists, fetch existing
        return this.getApplicant(externalUserId);
      }
      throw error;
    }
  }

  /**
   * Get applicant by external user ID
   */
  async getApplicant(externalUserId: string): Promise<SumsubApplicantData> {
    const url = `/resources/applicants/-;externalUserId=${externalUserId}`;
    const headers = this.createAuthHeaders('GET', url);

    const response = await this.axiosInstance.get<{ list: { items: SumsubApplicantData[] } }>(
      url,
      { headers }
    );

    if (!response.data.list.items.length) {
      throw new Error('Applicant not found');
    }

    return response.data.list.items[0]!;
  }

  /**
   * Get applicant status
   */
  async getApplicantStatus(applicantId: string): Promise<SumsubApplicantData> {
    const url = `/resources/applicants/${applicantId}/status`;
    const headers = this.createAuthHeaders('GET', url);

    const response = await this.axiosInstance.get<SumsubApplicantData>(
      url,
      { headers }
    );

    return response.data;
  }

  /**
   * Generate access token for WebSDK
   */
  async generateAccessToken(
    externalUserId: string,
    levelName?: string
  ): Promise<SumsubAccessToken> {
    const url = `/resources/accessTokens?userId=${externalUserId}&levelName=${levelName || this.levelName}`;
    
    // For access token generation, signature should be without body
    const headers = this.createAuthHeaders('POST', url);
    
    logger.info('Generating Sumsub access token', {
      url,
      externalUserId,
      levelName: levelName || this.levelName
    });

    try {
      // Use request method to have more control
      const response = await this.axiosInstance.request<{ token: string }>({
        method: 'POST',
        url,
        headers,
        // Explicitly no data
        data: undefined
      });

      return {
        token: response.data.token,
        userId: externalUserId,
      };
    } catch (error: any) {
      logger.error('Failed to generate access token', {
        error: error.response?.data,
        status: error.response?.status,
        url,
        externalUserId
      });
      throw error;
    }
  }

  /**
   * Reset applicant (for retrying verification)
   */
  async resetApplicant(applicantId: string): Promise<void> {
    const url = `/resources/applicants/${applicantId}/reset`;
    const body = {};
    const headers = this.createAuthHeaders('POST', url, body);

    await this.axiosInstance.post(url, body, { headers });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: any): WebhookPayload {
    return {
      applicantId: payload.applicantId,
      externalUserId: payload.externalUserId,
      type: payload.type,
      reviewStatus: payload.reviewStatus,
      reviewResult: payload.reviewResult,
      createdAt: payload.createdAt,
    };
  }
}

// Export singleton instance
let sumsubClient: SumsubClient | null = null;

export function getSumsubClient(): SumsubClient {
  if (!sumsubClient) {
    sumsubClient = new SumsubClient();
  }
  return sumsubClient;
}