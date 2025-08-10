import { supabase } from '../../config/database';
import { LoggerService } from '../../services/logging/loggerService';

const logger = new LoggerService();

export interface AuditLogFilter {
  userId?: string;
  eventType?: string;
  eventCategory?: string;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  result?: 'success' | 'failure';
  limit?: number;
  offset?: number;
}

export interface AuditLogStats {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  topUsers: Array<{ userId: string; eventCount: number }>;
  topIpAddresses: Array<{ ipAddress: string; eventCount: number }>;
}

export class AuditLogRepository {
  /**
   * Create audit log entry
   */
  static async create(auditLog: any): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('security_audit_logs')
        .insert(auditLog);

      if (error) {
        logger.error('Failed to create audit log', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error creating audit log', error);
      return { success: false, error: 'Failed to create audit log' };
    }
  }

  /**
   * Batch insert audit logs
   */
  static async createBatch(auditLogs: any[]): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('security_audit_logs')
        .insert(auditLogs);

      if (error) {
        logger.error('Failed to batch insert audit logs', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Error batch inserting audit logs', error);
      return { success: false, error: 'Failed to batch insert audit logs' };
    }
  }

  /**
   * Query audit logs with filters
   */
  static async query(filters: AuditLogFilter): Promise<{
    data: any[];
    total: number;
    error?: string;
  }> {
    try {
      let query = supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.eventType) {
        query = query.eq('action', filters.eventType);
      }

      if (filters.eventCategory) {
        query = query.contains('metadata', { event_category: filters.eventCategory });
      }

      if (filters.severity) {
        query = query.contains('metadata', { event_severity: filters.severity });
      }

      if (filters.ipAddress) {
        query = query.eq('ip_address', filters.ipAddress);
      }

      if (filters.result) {
        query = query.eq('result', filters.result);
      }

      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString());
      }

      // Apply pagination
      query = query.order('timestamp', { ascending: false });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to query audit logs', error);
        return { data: [], total: 0, error: error.message };
      }

      return {
        data: data || [],
        total: count || 0
      };
    } catch (error) {
      logger.error('Error querying audit logs', error);
      return { data: [], total: 0, error: 'Failed to query audit logs' };
    }
  }

  /**
   * Get audit log statistics using database aggregation
   */
  static async getStats(filters: {
    startDate: Date;
    endDate: Date;
    userId?: string;
  }): Promise<AuditLogStats> {
    try {
      // Use multiple optimized queries instead of loading all data
      
      // Get total counts
      const countQuery = supabase
        .from('security_audit_logs')
        .select('result', { count: 'exact', head: true })
        .gte('timestamp', filters.startDate.toISOString())
        .lte('timestamp', filters.endDate.toISOString());

      if (filters.userId) {
        countQuery.eq('user_id', filters.userId);
      }

      const { count: totalEvents } = await countQuery;

      // Get success/failure counts
      const successQuery = supabase
        .from('security_audit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('result', 'success')
        .gte('timestamp', filters.startDate.toISOString())
        .lte('timestamp', filters.endDate.toISOString());

      if (filters.userId) {
        successQuery.eq('user_id', filters.userId);
      }

      const { count: successfulEvents } = await successQuery;

      // Get aggregated data for types (limit to top 20)
      const typeQuery = supabase
        .from('security_audit_logs')
        .select('action')
        .gte('timestamp', filters.startDate.toISOString())
        .lte('timestamp', filters.endDate.toISOString())
        .limit(1000); // Process in batches

      if (filters.userId) {
        typeQuery.eq('user_id', filters.userId);
      }

      const { data: typeData } = await typeQuery;

      // Count events by type
      const eventsByType: Record<string, number> = {};
      if (typeData) {
        for (const log of typeData) {
          eventsByType[log.action] = (eventsByType[log.action] || 0) + 1;
        }
      }

      // Get top users - using simpler approach with limited data
      const topUsersQuery = supabase
        .from('security_audit_logs')
        .select('user_id')
        .gte('timestamp', filters.startDate.toISOString())
        .lte('timestamp', filters.endDate.toISOString())
        .limit(500);

      if (filters.userId) {
        topUsersQuery.eq('user_id', filters.userId);
      }

      const { data: userData } = await topUsersQuery;

      const userCount: Record<string, number> = {};
      if (userData) {
        for (const log of userData) {
          if (log.user_id) {
            userCount[log.user_id] = (userCount[log.user_id] || 0) + 1;
          }
        }
      }

      const topUsers = Object.entries(userCount)
        .map(([userId, count]) => ({ userId, eventCount: count }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10);

      // Get top IPs similarly
      const ipQuery = supabase
        .from('security_audit_logs')
        .select('ip_address')
        .gte('timestamp', filters.startDate.toISOString())
        .lte('timestamp', filters.endDate.toISOString())
        .not('ip_address', 'is', null)
        .limit(500);

      if (filters.userId) {
        ipQuery.eq('user_id', filters.userId);
      }

      const { data: ipData } = await ipQuery;

      const ipCount: Record<string, number> = {};
      if (ipData) {
        for (const log of ipData) {
          if (log.ip_address) {
            ipCount[log.ip_address] = (ipCount[log.ip_address] || 0) + 1;
          }
        }
      }

      const topIpAddresses = Object.entries(ipCount)
        .map(([ipAddress, count]) => ({ ipAddress, eventCount: count }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10);

      // For severity counts, we'll sample a subset
      const severityQuery = supabase
        .from('security_audit_logs')
        .select('metadata')
        .gte('timestamp', filters.startDate.toISOString())
        .lte('timestamp', filters.endDate.toISOString())
        .limit(200);

      if (filters.userId) {
        severityQuery.eq('user_id', filters.userId);
      }

      const { data: severityData } = await severityQuery;

      const eventsBySeverity: Record<string, number> = {};
      if (severityData) {
        for (const log of severityData) {
          if (log.metadata) {
            const metadata = typeof log.metadata === 'string' 
              ? JSON.parse(log.metadata) 
              : log.metadata;
            if (metadata.event_severity) {
              eventsBySeverity[metadata.event_severity] = (eventsBySeverity[metadata.event_severity] || 0) + 1;
            }
          }
        }
      }

      return {
        totalEvents: totalEvents || 0,
        successfulEvents: successfulEvents || 0,
        failedEvents: (totalEvents || 0) - (successfulEvents || 0),
        eventsByType,
        eventsBySeverity,
        topUsers,
        topIpAddresses
      };
    } catch (error) {
      logger.error('Error calculating audit stats', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get empty stats object
   */
  private static getEmptyStats(): AuditLogStats {
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      topUsers: [],
      topIpAddresses: []
    };
  }

  /**
   * Delete old audit logs (data retention)
   */
  static async deleteOldLogs(retentionDays: number = 90): Promise<{ deletedCount: number; error?: string }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await supabase
        .from('security_audit_logs')
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select();

      if (error) {
        logger.error('Failed to delete old audit logs', error);
        return { deletedCount: 0, error: error.message };
      }

      const deletedCount = data?.length || 0;
      logger.info(`Deleted ${deletedCount} audit logs older than ${retentionDays} days`);

      return { deletedCount };
    } catch (error) {
      logger.error('Error deleting old audit logs', error);
      return { deletedCount: 0, error: 'Failed to delete old audit logs' };
    }
  }

  /**
   * Get user activity timeline
   */
  static async getUserActivityTimeline(
    userId: string,
    days: number = 7
  ): Promise<{ data: any[]; error?: string }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        logger.error('Failed to get user activity timeline', error);
        return { data: [], error: error.message };
      }

      return { data: data || [] };
    } catch (error) {
      logger.error('Error getting user activity timeline', error);
      return { data: [], error: 'Failed to get user activity timeline' };
    }
  }
}