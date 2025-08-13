import { Request, Response } from 'express';
import { configValidationService } from '../../services/configValidationService';
import logger from '../../utils/logger';

/**
 * Health Check Controller
 * Provides endpoints for monitoring system health and configuration status
 */

export class HealthController {
  /**
   * Basic health check endpoint
   * GET /api/health
   */
  static async getHealth(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env['NODE_ENV'],
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  }

  /**
   * Configuration health check endpoint
   * GET /api/health/config
   */
  static async getConfigHealth(_req: Request, res: Response): Promise<void> {
    try {
      const health = configValidationService.getHealthStatus();
      
      // Determine HTTP status based on health status
      const httpStatus = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 206 : 503;

      res.status(httpStatus).json({
        status: health.status,
        lastValidation: health.lastValidation,
        categories: health.categories,
        secretsExpiring: health.secretsExpiring,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Config health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Configuration health check failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Validate specific configuration category
   * GET /api/health/config/:category
   */
  static async validateConfigCategory(req: Request, res: Response): Promise<void> {
    try {
      const { category } = req.params;
      const validation = configValidationService.validateCategory(category!);
      
      res.status(validation.valid ? 200 : 400).json({
        category,
        valid: validation.valid,
        errors: validation.errors,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Category validation failed:', error);
      res.status(500).json({
        error: 'Category validation failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get masked configuration (safe for display)
   * GET /api/health/config/masked
   */
  static async getMaskedConfig(_req: Request, res: Response): Promise<void> {
    try {
      const maskedConfig = configValidationService.getMaskedConfig();
      
      res.status(200).json({
        config: maskedConfig,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get masked config:', error);
      res.status(500).json({
        error: 'Failed to retrieve configuration',
        timestamp: new Date().toISOString(),
      });
    }
  }
}