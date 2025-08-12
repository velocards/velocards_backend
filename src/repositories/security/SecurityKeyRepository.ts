import { BaseRepository } from '../BaseRepository'
import { supabase } from '../../config/database'
import { AppError } from '../../utils/errors'
import { AuditableEntity } from '../interfaces'
import logger from '../../utils/logger'
import { AuditLogRepository } from './AuditLogRepository'
import * as bcrypt from 'bcryptjs'

export interface SecurityKey extends AuditableEntity {
  id: string
  user_id: string
  key_type: 'api' | 'encryption' | 'signing' | 'mfa'
  key_value?: string
  key_hash?: string
  public_key?: string
  encrypted_private_key?: string
  algorithm?: string
  expires_at?: Date
  last_used_at?: Date
  is_active: boolean
  metadata?: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

export interface SecurityKeyFilter {
  userId?: string
  keyType?: string
  isActive?: boolean
  expiresAfter?: Date
  expiresBefore?: Date
}

export class SecurityKeyRepository extends BaseRepository<SecurityKey> {
  private auditLogRepo: AuditLogRepository

  constructor() {
    super('security_keys', supabase)
    this.auditLogRepo = new AuditLogRepository()
  }

  async createSecurityKey(keyData: Partial<SecurityKey> & { key_value?: string }, userId: string): Promise<SecurityKey> {
    try {
      // Hash the key value if provided (for API keys)
      const dataToStore: Partial<SecurityKey> = { ...keyData }
      if (keyData.key_value) {
        const saltRounds = 10
        dataToStore.key_hash = await bcrypt.hash(keyData.key_value, saltRounds)
        // Don't store the plain key value
        delete (dataToStore as any).key_value
      }

      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_CREATE',
        userId,
        { keyType: keyData.key_type, userId: keyData.user_id },
        'success',
        'high'
      )

      const key = await this.create({
        ...dataToStore,
        is_active: dataToStore.is_active ?? true,
        created_at: new Date(),
        updated_at: new Date()
      }, userId)

      this.logAudit('SECURITY_KEY_CREATE', key.id, { keyType: key.key_type }, userId)

      return key
    } catch (error) {
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_CREATE',
        userId,
        { error: (error as Error).message, keyType: keyData.key_type },
        'failure',
        'critical'
      )
      throw error
    }
  }

  async rotateKey(keyId: string, userId: string): Promise<SecurityKey> {
    try {
      const existingKey = await this.findById(keyId)
      if (!existingKey) {
        throw new AppError('NOT_FOUND', 'Security key not found', 404)
      }

      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_ROTATE',
        userId,
        { keyId, keyType: existingKey.key_type },
        'success',
        'high'
      )

      await this.update(keyId, { is_active: false }, userId)

      const keyData: Partial<SecurityKey> = {
        user_id: existingKey.user_id,
        key_type: existingKey.key_type,
        metadata: {
          ...existingKey.metadata,
          rotated_from: keyId,
          rotated_at: new Date().toISOString()
        }
      }
      
      if (existingKey.algorithm) {
        keyData.algorithm = existingKey.algorithm
      }
      
      const newKey = await this.createSecurityKey(keyData, userId)

      this.logAudit('SECURITY_KEY_ROTATE', keyId, { newKeyId: newKey.id }, userId)

      return newKey
    } catch (error) {
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_ROTATE',
        userId,
        { error: (error as Error).message, keyId },
        'failure',
        'critical'
      )
      throw error
    }
  }

  async revokeKey(keyId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_REVOKE',
        userId,
        { keyId, reason },
        'success',
        'high'
      )

      await this.update(keyId, {
        is_active: false,
        metadata: {
          revoked_at: new Date().toISOString(),
          revoked_by: userId,
          revocation_reason: reason
        }
      }, userId)

      this.logAudit('SECURITY_KEY_REVOKE', keyId, { reason }, userId)

      return true
    } catch (error) {
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_REVOKE',
        userId,
        { error: (error as Error).message, keyId },
        'failure',
        'critical'
      )
      throw error
    }
  }

  async findActiveKeysByUser(userId: string): Promise<SecurityKey[]> {
    try {
      const keys = await this.query({
        where: { user_id: userId, is_active: true },
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      })

      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_LIST',
        userId,
        { count: keys.length },
        'success',
        'low'
      )

      return keys
    } catch (error) {
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_LIST',
        userId,
        { error: (error as Error).message },
        'failure',
        'medium'
      )
      throw error
    }
  }

  async findKeysByType(keyType: string, userId?: string): Promise<SecurityKey[]> {
    try {
      const whereClause: Record<string, unknown> = { key_type: keyType, is_active: true }
      if (userId) {
        whereClause['user_id'] = userId
      }

      const keys = await this.query({
        where: whereClause,
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      })

      if (userId) {
        await this.auditLogRepo.logSecurityEvent(
          'SECURITY_KEY_QUERY',
          userId,
          { keyType, count: keys.length },
          'success',
          'low'
        )
      }

      return keys
    } catch (error) {
      if (userId) {
        await this.auditLogRepo.logSecurityEvent(
          'SECURITY_KEY_QUERY',
          userId,
          { error: (error as Error).message, keyType },
          'failure',
          'medium'
        )
      }
      throw error
    }
  }

  async findExpiredKeys(): Promise<SecurityKey[]> {
    try {
      const now = new Date()
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('is_active', true)
        .lt('expires_at', now.toISOString())

      if (error) {
        throw new AppError('DATABASE_ERROR', error.message, 500)
      }

      return (data || []) as SecurityKey[]
    } catch (error) {
      logger.error('Error finding expired keys', error)
      throw error
    }
  }

  async updateLastUsed(keyId: string): Promise<void> {
    try {
      await this.supabase
        .from(this.tableName)
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId)
    } catch (error) {
      logger.error('Error updating last used timestamp', error)
    }
  }

  async cleanupExpiredKeys(): Promise<number> {
    try {
      const expiredKeys = await this.findExpiredKeys()

      for (const key of expiredKeys) {
        await this.revokeKey(key.id, 'system', 'Expired')
      }

      logger.info(`Cleaned up ${expiredKeys.length} expired security keys`)

      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_CLEANUP',
        'system',
        { count: expiredKeys.length },
        'success',
        'medium'
      )

      return expiredKeys.length
    } catch (error) {
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_CLEANUP',
        'system',
        { error: (error as Error).message },
        'failure',
        'high'
      )
      throw error
    }
  }

  async validateKey(keyId: string, keyValue?: string): Promise<boolean> {
    try {
      if (!keyId) {
        logger.warn('Key validation attempted with missing keyId')
        return false
      }

      const key = await this.findById(keyId)
      
      if (!key || !key.is_active) {
        await this.auditLogRepo.logSecurityEvent(
          'SECURITY_KEY_VALIDATE',
          undefined,
          { keyId, result: 'invalid_key' },
          'failure',
          'medium'
        )
        return false
      }

      if (key.expires_at && new Date(key.expires_at) < new Date()) {
        await this.revokeKey(keyId, 'system', 'Expired during validation')
        await this.auditLogRepo.logSecurityEvent(
          'SECURITY_KEY_VALIDATE',
          key.user_id,
          { keyId, result: 'expired' },
          'failure',
          'high'
        )
        return false
      }

      // Validate key value if provided (for API keys with hash comparison)
      if (keyValue && key.key_hash) {
        const isValidHash = await bcrypt.compare(keyValue, key.key_hash)
        if (!isValidHash) {
          await this.auditLogRepo.logSecurityEvent(
            'SECURITY_KEY_VALIDATE',
            key.user_id,
            { keyId, result: 'invalid_hash' },
            'failure',
            'critical'
          )
          return false
        }
        logger.debug('Key hash validation successful', { keyId })
      }

      await this.updateLastUsed(keyId)
      
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_VALIDATE',
        key.user_id,
        { keyId, keyType: key.key_type },
        'success',
        'low'
      )

      return true
    } catch (error) {
      logger.error('Error validating key', error)
      await this.auditLogRepo.logSecurityEvent(
        'SECURITY_KEY_VALIDATE',
        undefined,
        { keyId, error: (error as Error).message },
        'failure',
        'high'
      )
      return false
    }
  }
}