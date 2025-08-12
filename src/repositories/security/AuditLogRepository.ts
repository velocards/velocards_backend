import { BaseRepository } from '../BaseRepository'
import { supabase } from '../../config/database'
import { AppError } from '../../utils/errors'
import { AuditableEntity } from '../interfaces'
import logger from '../../utils/logger'

export interface AuditLog extends AuditableEntity {
  id: string
  user_id?: string
  action: string
  ip_address?: string
  user_agent?: string
  result: 'success' | 'failure'
  metadata?: Record<string, unknown>
  timestamp: Date
  event_category?: string
  event_severity?: 'low' | 'medium' | 'high' | 'critical'
}

export interface AuditLogFilter {
  userId?: string
  eventType?: string
  eventCategory?: string
  severity?: string
  startDate?: Date
  endDate?: Date
  ipAddress?: string
  result?: 'success' | 'failure'
  limit?: number
  offset?: number
}

export interface AuditLogStats {
  totalEvents: number
  successfulEvents: number
  failedEvents: number
  eventsByType: Record<string, number>
  eventsBySeverity: Record<string, number>
  topUsers: Array<{ userId: string; eventCount: number }>
  topIpAddresses: Array<{ ipAddress: string; eventCount: number }>
}

export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor() {
    super('security_audit_logs', supabase)
  }

  async createAuditLog(auditLog: Partial<AuditLog>, userId?: string): Promise<AuditLog> {
    const logData: Partial<AuditLog> = {
      ...auditLog,
      timestamp: auditLog.timestamp || new Date(),
      result: auditLog.result || 'success'
    }

    this.logAudit('AUDIT_LOG_CREATE', logData.id, logData, userId)
    
    return this.create(logData, userId)
  }

  async batchCreate(auditLogs: Partial<AuditLog>[]): Promise<{ success: boolean; error?: string }> {
    try {
      const logsWithTimestamp = auditLogs.map(log => ({
        ...log,
        timestamp: log.timestamp || new Date(),
        result: log.result || 'success'
      }))

      const { error } = await this.supabase
        .from(this.tableName)
        .insert(logsWithTimestamp)

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return { success: true }
    } catch (error) {
      const appError = this.mapDatabaseError(error)
      return { success: false, error: appError.message }
    }
  }

  async queryLogs(filters: AuditLogFilter): Promise<{
    data: AuditLog[]
    total: number
    error?: string
  }> {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact' })

      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters.eventType) {
        query = query.eq('action', filters.eventType)
      }

      if (filters.eventCategory) {
        query = query.eq('event_category', filters.eventCategory)
      }

      if (filters.severity) {
        query = query.eq('event_severity', filters.severity)
      }

      if (filters.ipAddress) {
        query = query.eq('ip_address', filters.ipAddress)
      }

      if (filters.result) {
        query = query.eq('result', filters.result)
      }

      if (filters.startDate) {
        query = query.gte('timestamp', filters.startDate.toISOString())
      }

      if (filters.endDate) {
        query = query.lte('timestamp', filters.endDate.toISOString())
      }

      query = query.order('timestamp', { ascending: false })

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
      }

      const { data, error, count } = await query

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return {
        data: (data || []) as AuditLog[],
        total: count || 0
      }
    } catch (error) {
      const appError = this.mapDatabaseError(error)
      return { data: [], total: 0, error: appError.message }
    }
  }

  async getStats(filters: {
    startDate: Date
    endDate: Date
    userId?: string
  }): Promise<AuditLogStats> {
    try {
      const baseQuery = {
        gte: filters.startDate.toISOString(),
        lte: filters.endDate.toISOString(),
        ...(filters.userId && { userId: filters.userId })
      }

      const countQuery = this.supabase
        .from(this.tableName)
        .select('result', { count: 'exact', head: true })
        .gte('timestamp', baseQuery.gte)
        .lte('timestamp', baseQuery.lte)

      if (filters.userId) {
        countQuery.eq('user_id', filters.userId)
      }

      const { count: totalEvents } = await countQuery

      const successQuery = this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('result', 'success')
        .gte('timestamp', baseQuery.gte)
        .lte('timestamp', baseQuery.lte)

      if (filters.userId) {
        successQuery.eq('user_id', filters.userId)
      }

      const { count: successfulEvents } = await successQuery

      const typeQuery = this.supabase
        .from(this.tableName)
        .select('action')
        .gte('timestamp', baseQuery.gte)
        .lte('timestamp', baseQuery.lte)
        .limit(1000)

      if (filters.userId) {
        typeQuery.eq('user_id', filters.userId)
      }

      const { data: typeData } = await typeQuery

      const eventsByType: Record<string, number> = {}
      if (typeData) {
        for (const log of typeData) {
          eventsByType[log.action] = (eventsByType[log.action] || 0) + 1
        }
      }

      const topUsersQuery = this.supabase
        .from(this.tableName)
        .select('user_id')
        .gte('timestamp', baseQuery.gte)
        .lte('timestamp', baseQuery.lte)
        .limit(500)

      if (filters.userId) {
        topUsersQuery.eq('user_id', filters.userId)
      }

      const { data: userData } = await topUsersQuery

      const userCount: Record<string, number> = {}
      if (userData) {
        for (const log of userData) {
          if (log.user_id) {
            userCount[log.user_id] = (userCount[log.user_id] || 0) + 1
          }
        }
      }

      const topUsers = Object.entries(userCount)
        .map(([userId, count]) => ({ userId, eventCount: count }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10)

      const ipQuery = this.supabase
        .from(this.tableName)
        .select('ip_address')
        .gte('timestamp', baseQuery.gte)
        .lte('timestamp', baseQuery.lte)
        .not('ip_address', 'is', null)
        .limit(500)

      if (filters.userId) {
        ipQuery.eq('user_id', filters.userId)
      }

      const { data: ipData } = await ipQuery

      const ipCount: Record<string, number> = {}
      if (ipData) {
        for (const log of ipData) {
          if (log.ip_address) {
            ipCount[log.ip_address] = (ipCount[log.ip_address] || 0) + 1
          }
        }
      }

      const topIpAddresses = Object.entries(ipCount)
        .map(([ipAddress, count]) => ({ ipAddress, eventCount: count }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10)

      const severityQuery = this.supabase
        .from(this.tableName)
        .select('event_severity')
        .gte('timestamp', baseQuery.gte)
        .lte('timestamp', baseQuery.lte)
        .limit(200)

      if (filters.userId) {
        severityQuery.eq('user_id', filters.userId)
      }

      const { data: severityData } = await severityQuery

      const eventsBySeverity: Record<string, number> = {}
      if (severityData) {
        for (const log of severityData) {
          if (log.event_severity) {
            eventsBySeverity[log.event_severity] = (eventsBySeverity[log.event_severity] || 0) + 1
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
      }
    } catch (error) {
      logger.error('Error calculating audit stats', error)
      return this.getEmptyStats()
    }
  }

  private getEmptyStats(): AuditLogStats {
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      topUsers: [],
      topIpAddresses: []
    }
  }

  async deleteOldLogs(retentionDays: number = 90): Promise<{ deletedCount: number; error?: string }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      this.logAudit('AUDIT_LOG_CLEANUP', undefined, { retentionDays, cutoffDate }, 'system')

      const { data, error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt('timestamp', cutoffDate.toISOString())
        .select()

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      const deletedCount = data?.length || 0
      logger.info(`Deleted ${deletedCount} audit logs older than ${retentionDays} days`)

      return { deletedCount }
    } catch (error) {
      const appError = this.mapDatabaseError(error)
      return { deletedCount: 0, error: appError.message }
    }
  }

  async getUserActivityTimeline(
    userId: string,
    days: number = 7
  ): Promise<{ data: AuditLog[]; error?: string }> {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return { data: (data || []) as AuditLog[] }
    } catch (error) {
      const appError = this.mapDatabaseError(error)
      logger.error('Error getting user activity timeline', error)
      return { data: [], error: appError.message }
    }
  }

  async logSecurityEvent(
    action: string,
    userId: string | undefined,
    metadata: Record<string, unknown>,
    result: 'success' | 'failure',
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    try {
      const auditData: Partial<AuditLog> = {
        action,
        result,
        metadata,
        event_severity: severity,
        event_category: 'SECURITY',
        timestamp: new Date()
      }
      
      if (userId) {
        auditData.user_id = userId
      }
      
      await this.createAuditLog(auditData, userId)
    } catch (error) {
      logger.error('Failed to log security event:', error)
    }
  }

  static async create(auditLog: any): Promise<{ success: boolean; error?: string }> {
    const instance = new AuditLogRepository()
    try {
      await instance.createAuditLog(auditLog)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async createBatch(auditLogs: any[]): Promise<{ success: boolean; error?: string }> {
    const instance = new AuditLogRepository()
    return instance.batchCreate(auditLogs)
  }

  static async query(filters: AuditLogFilter): Promise<{
    data: any[]
    total: number
    error?: string
  }> {
    const instance = new AuditLogRepository()
    return instance.queryLogs(filters)
  }

  static async getStats(filters: {
    startDate: Date
    endDate: Date
    userId?: string
  }): Promise<AuditLogStats> {
    const instance = new AuditLogRepository()
    return instance.getStats(filters)
  }

  static async deleteOldLogs(retentionDays: number = 90): Promise<{ deletedCount: number; error?: string }> {
    const instance = new AuditLogRepository()
    return instance.deleteOldLogs(retentionDays)
  }

  static async getUserActivityTimeline(
    userId: string,
    days: number = 7
  ): Promise<{ data: any[]; error?: string }> {
    const instance = new AuditLogRepository()
    return instance.getUserActivityTimeline(userId, days)
  }
}