import { Response } from 'express';
import { AuditLogRepository } from '../../../repositories/security/auditLogRepository';
import { RateLimitService } from '../../../services/security/rateLimitService';
import { AnomalyDetectionService } from '../../../services/security/anomalyDetectionService';
import { LoggerService } from '../../../services/logging/loggerService';
import { AuthRequest } from '../../middlewares/auth';

const logger = new LoggerService();

export class SecurityMonitoringController {
  /**
   * GET /api/v2/security/audit-logs
   * Query audit logs with filters
   */
  static async getAuditLogs(req: AuthRequest, res: Response) {
    try {
      const {
        userId,
        eventType,
        eventCategory,
        severity,
        startDate,
        endDate,
        ipAddress,
        result,
        page = 1,
        limit = 50
      } = req.query;

      // Calculate offset
      const offset = (Number(page) - 1) * Number(limit);

      // Build filters
      const filters: any = {};
      if (userId) filters.userId = userId as string;
      if (eventType) filters.eventType = eventType as string;
      if (eventCategory) filters.eventCategory = eventCategory as string;
      if (severity) filters.severity = severity as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (ipAddress) filters.ipAddress = ipAddress as string;
      if (result) filters.result = result as 'success' | 'failure';
      filters.limit = Number(limit);
      filters.offset = offset;

      // Query audit logs
      const { data, total, error } = await AuditLogRepository.query(filters);

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to query audit logs'
        });
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / Number(limit));
      const hasNextPage = Number(page) < totalPages;
      const hasPrevPage = Number(page) > 1;

      return res.json({
        success: true,
        data: {
          logs: data,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages,
            hasNextPage,
            hasPrevPage
          }
        }
      });
    } catch (error) {
      logger.error('Error getting audit logs', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/v2/security/metrics
   * Get security dashboard metrics
   */
  static async getSecurityMetrics(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, userId } = req.query;

      // Default to last 7 days if no dates provided
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Get audit log statistics
      const auditStats = await AuditLogRepository.getStats({
        startDate: start,
        endDate: end,
        userId: userId as string
      });

      // Get rate limit metrics
      const rateLimitMetrics = await RateLimitService.getMetrics(24);

      // Get anomaly detection config
      const anomalyConfig = AnomalyDetectionService.getConfig();

      // Build response
      const metrics = {
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        auditLogs: {
          total: auditStats.totalEvents,
          successful: auditStats.successfulEvents,
          failed: auditStats.failedEvents,
          byType: auditStats.eventsByType,
          bySeverity: auditStats.eventsBySeverity,
          topUsers: auditStats.topUsers.slice(0, 5),
          topIpAddresses: auditStats.topIpAddresses.slice(0, 5)
        },
        rateLimits: {
          totalRequests: rateLimitMetrics.totalRequests,
          violations: rateLimitMetrics.violationCount,
          topUsers: rateLimitMetrics.topUsers.slice(0, 5),
          topEndpoints: rateLimitMetrics.topEndpoints,
          violationsByEndpoint: rateLimitMetrics.violationsByEndpoint
        },
        anomalyDetection: {
          config: anomalyConfig,
          enabled: true
        },
        alerts: {
          // TODO: Get from alert service once implemented
          active: 0,
          resolved: 0,
          pending: 0
        }
      };

      return res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting security metrics', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/v2/rate-limit/status
   * Get current rate limit status for authenticated user
   */
  static async getRateLimitStatus(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const status = await RateLimitService.getRateLimitStatus(userId);

      return res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Error getting rate limit status', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/v2/security/user-activity/:userId
   * Get user activity timeline
   */
  static async getUserActivity(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { days = 7 } = req.query;

      // Check if user has permission to view this data
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      const { data, error } = await AuditLogRepository.getUserActivityTimeline(
        userId || '',
        Number(days)
      );

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to get user activity'
        });
      }

      return res.json({
        success: true,
        data: {
          userId,
          days: Number(days),
          activities: data
        }
      });
    } catch (error) {
      logger.error('Error getting user activity', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * POST /api/v2/security/anomaly-config
   * Update anomaly detection configuration (admin only)
   */
  static async updateAnomalyConfig(req: AuthRequest, res: Response) {
    try {
      // Check admin permission
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin permission required'
        });
      }

      const config = req.body;

      // Validate config structure
      if (!config || typeof config !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid configuration format'
        });
      }

      // Define validation rules
      const validationRules: Record<string, { min: number; max: number; type: string }> = {
        failedLoginThreshold: { min: 1, max: 100, type: 'number' },
        failedLoginWindow: { min: 1, max: 1440, type: 'number' }, // Max 24 hours in minutes
        bruteForceThreshold: { min: 1, max: 1000, type: 'number' },
        bruteForceWindow: { min: 1, max: 60, type: 'number' }, // Max 1 hour in minutes
        ipAnomalyThreshold: { min: 1, max: 50, type: 'number' },
        unusualAccessThreshold: { min: 10, max: 10000, type: 'number' }
      };

      const validKeys = Object.keys(validationRules);
      const invalidKeys = Object.keys(config).filter(key => !validKeys.includes(key));
      
      if (invalidKeys.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid configuration keys: ${invalidKeys.join(', ')}`
        });
      }

      // Validate each configuration value
      const errors: string[] = [];
      for (const [key, value] of Object.entries(config)) {
        const rule = validationRules[key];
        if (!rule) continue;
        
        // Type validation
        if (typeof value !== rule.type) {
          errors.push(`${key} must be a ${rule.type}`);
          continue;
        }

        // Range validation for numbers
        if (rule.type === 'number') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push(`${key} must be a valid number`);
          } else if (numValue < rule.min || numValue > rule.max) {
            errors.push(`${key} must be between ${rule.min} and ${rule.max}`);
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation errors',
          details: errors
        });
      }

      // Update configuration
      AnomalyDetectionService.updateConfig(config);

      // Log the configuration change
      logger.audit(
        'security.config_updated',
        'anomaly_detection',
        undefined,
        {
          updatedBy: req.user.id,
          newConfig: config
        }
      );

      return res.json({
        success: true,
        data: {
          message: 'Anomaly detection configuration updated',
          config: AnomalyDetectionService.getConfig()
        }
      });
    } catch (error) {
      logger.error('Error updating anomaly config', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * POST /api/v2/security/audit-logs/cleanup
   * Clean up old audit logs (admin only)
   */
  static async cleanupAuditLogs(req: AuthRequest, res: Response) {
    try {
      // Check admin permission
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin permission required'
        });
      }

      const { retentionDays = 90 } = req.body;

      if (retentionDays < 30) {
        return res.status(400).json({
          success: false,
          error: 'Retention period must be at least 30 days'
        });
      }

      const { deletedCount, error } = await AuditLogRepository.deleteOldLogs(retentionDays);

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to cleanup audit logs'
        });
      }

      // Log the cleanup action
      logger.audit(
        'security.audit_logs_cleanup',
        'maintenance',
        undefined,
        {
          performedBy: req.user.id,
          retentionDays,
          deletedCount
        }
      );

      return res.json({
        success: true,
        data: {
          message: 'Audit logs cleanup completed',
          deletedCount,
          retentionDays
        }
      });
    } catch (error) {
      logger.error('Error cleaning up audit logs', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * GET /api/v2/security/export
   * Export audit logs (admin only)
   */
  static async exportAuditLogs(req: AuthRequest, res: Response) {
    try {
      // Check admin permission
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin permission required'
        });
      }

      const {
        startDate,
        endDate,
        format = 'json'
      } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      // Query audit logs
      const { data, error } = await AuditLogRepository.query({
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string),
        limit: 10000 // Max export limit
      });

      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Failed to export audit logs'
        });
      }

      // Log the export action
      logger.audit(
        'security.audit_logs_exported',
        'data_export',
        undefined,
        {
          exportedBy: req.user.id,
          startDate,
          endDate,
          recordCount: data.length,
          format
        }
      );

      if (format === 'csv') {
        // Convert to CSV
        const csv = this.convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
        return res.send(csv);
      }

      // Default to JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.json`);
      return res.json(data);
    } catch (error) {
      logger.error('Error exporting audit logs', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Convert data to CSV format with injection protection
   */
  private static convertToCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    // Function to escape CSV values and prevent injection
    const escapeCSVValue = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }

      let strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

      // Prevent CSV injection by prefixing dangerous characters with a single quote
      // This prevents Excel/LibreOffice from interpreting as formulas
      if (strValue.match(/^[=+\-@\t\r]/)) {
        strValue = "'" + strValue;
      }

      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (strValue.includes('"') || strValue.includes(',') || strValue.includes('\n')) {
        strValue = '"' + strValue.replace(/"/g, '""') + '"';
      }

      return strValue;
    };

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.map(escapeCSVValue).join(',');

    // Convert each row
    const csvRows = data.map(row => {
      return headers.map(header => escapeCSVValue(row[header])).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }
}