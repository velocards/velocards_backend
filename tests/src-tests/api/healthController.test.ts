import { Request, Response } from 'express';
import { HealthController } from '../../../src/api/controllers/healthController';
import { configValidationService } from '../../../src/services/configValidationService';

// Mock the configValidationService
jest.mock('../../../src/services/configValidationService');

describe('HealthController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    responseJson = jest.fn();
    responseStatus = jest.fn().mockReturnValue({ json: responseJson });
    
    mockRequest = {};
    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };
  });

  describe('getHealth', () => {
    it('should return healthy status', async () => {
      await HealthController.getHealth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          environment: expect.any(String),
        })
      );
    });
  });

  describe('getConfigHealth', () => {
    it('should return config health status', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        lastValidation: new Date(),
        categories: { Application: true, Database: true },
        secretsExpiring: [],
      };

      (configValidationService.getHealthStatus as jest.Mock).mockReturnValue(mockHealth);

      await HealthController.getConfigHealth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          categories: mockHealth.categories,
          secretsExpiring: [],
        })
      );
    });

    it('should return degraded status with 206', async () => {
      const mockHealth = {
        status: 'degraded' as const,
        lastValidation: new Date(),
        categories: { Application: true, Database: false },
        secretsExpiring: ['JWT_SECRET'],
      };

      (configValidationService.getHealthStatus as jest.Mock).mockReturnValue(mockHealth);

      await HealthController.getConfigHealth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(206);
    });

    it('should return unhealthy status with 503', async () => {
      const mockHealth = {
        status: 'unhealthy' as const,
        lastValidation: null,
        categories: { Application: false, Database: false },
        secretsExpiring: [],
      };

      (configValidationService.getHealthStatus as jest.Mock).mockReturnValue(mockHealth);

      await HealthController.getConfigHealth(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(503);
    });
  });

  describe('validateConfigCategory', () => {
    it('should validate a specific category', async () => {
      mockRequest.params = { category: 'Application' };
      
      const mockValidation = {
        valid: true,
        errors: undefined,
      };

      (configValidationService.validateCategory as jest.Mock).mockReturnValue(mockValidation);

      await HealthController.validateConfigCategory(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Application',
          valid: true,
        })
      );
    });

    it('should return 400 for invalid category', async () => {
      mockRequest.params = { category: 'InvalidCategory' };
      
      const mockValidation = {
        valid: false,
        errors: ['Unknown category: InvalidCategory'],
      };

      (configValidationService.validateCategory as jest.Mock).mockReturnValue(mockValidation);

      await HealthController.validateConfigCategory(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'InvalidCategory',
          valid: false,
          errors: mockValidation.errors,
        })
      );
    });
  });

  describe('getMaskedConfig', () => {
    it('should return masked configuration', async () => {
      const mockMaskedConfig = {
        NODE_ENV: 'test',
        PORT: 3001,
        DATABASE_URL: 'post****',
        JWT_SECRET: 'secr****',
      };

      (configValidationService.getMaskedConfig as jest.Mock).mockReturnValue(mockMaskedConfig);

      await HealthController.getMaskedConfig(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          config: mockMaskedConfig,
          timestamp: expect.any(String),
        })
      );
    });
  });
});