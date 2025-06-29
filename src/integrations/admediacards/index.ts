import { features } from '../../config/env';
import { AdmediacardsClient } from './client';
import { admediacardsClient as realClient } from './realClient';

// Export the appropriate client based on the feature flag
export const admediacardsClient = features.mockExternalApis 
  ? new AdmediacardsClient({
      apiKey: 'mock_api_key',
      baseUrl: 'https://api.admediacards.com',
      isLive: false
    })
  : realClient;

// Re-export types
export * from './client';