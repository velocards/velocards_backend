import * as crypto from 'crypto';
import { Request } from 'express';
import redis from '../config/redis';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

export interface SignatureOptions {
  algorithm?: string;
  expirySeconds?: number;
  includeBody?: boolean;
  includeQuery?: boolean;
}

export class RequestSigningService {
  private static NONCE_PREFIX = 'request_nonce:';
  private static DEFAULT_EXPIRY = 300; // 5 minutes
  private static DEFAULT_ALGORITHM = 'sha256';
  
  /**
   * Generate a signature for a request
   */
  static generateSignature(
    method: string,
    path: string,
    timestamp: number,
    nonce: string,
    body: any,
    secret: string,
    options: SignatureOptions = {}
  ): string {
    const {
      algorithm = this.DEFAULT_ALGORITHM,
      includeBody = true
    } = options;
    
    // Build the string to sign
    let stringToSign = `${method.toUpperCase()}:${path}:${timestamp}:${nonce}`;
    
    if (includeBody && body && Object.keys(body).length > 0) {
      // Sort body keys for consistent ordering
      const sortedBody = this.sortObject(body);
      stringToSign += `:${JSON.stringify(sortedBody)}`;
    }
    
    // Generate HMAC signature
    const signature = crypto
      .createHmac(algorithm, secret)
      .update(stringToSign)
      .digest('hex');
    
    return signature;
  }
  
  /**
   * Validate a request signature
   */
  static async validateSignature(
    req: Request,
    secret: string,
    options: SignatureOptions = {}
  ): Promise<boolean> {
    const {
      expirySeconds = this.DEFAULT_EXPIRY,
      algorithm = this.DEFAULT_ALGORITHM,
      includeBody = true
    } = options;
    
    // Extract signature headers
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const nonce = req.headers['x-nonce'] as string;
    
    if (!signature || !timestamp || !nonce) {
      logger.warn('Missing signature headers', {
        path: req.path,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        hasNonce: !!nonce
      });
      throw new ValidationError('Missing required signature headers');
    }
    
    // Validate timestamp (prevent replay attacks)
    const requestTime = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    
    if (isNaN(requestTime)) {
      throw new ValidationError('Invalid timestamp format');
    }
    
    if (Math.abs(now - requestTime) > expirySeconds) {
      logger.warn('Request timestamp expired', {
        requestTime,
        now,
        difference: Math.abs(now - requestTime),
        maxAllowed: expirySeconds
      });
      throw new ValidationError('Request signature has expired');
    }
    
    // Check nonce to prevent replay attacks
    try {
      const nonceKey = `${this.NONCE_PREFIX}${nonce}`;
      const exists = await redis.exists(nonceKey);
      
      if (exists) {
        logger.warn('Duplicate nonce detected', { nonce, path: req.path });
        throw new ValidationError('Duplicate request detected');
      }
      
      // Store nonce with expiry
      await redis.setex(nonceKey, expirySeconds * 2, '1');
    } catch (redisError) {
      logger.error('Redis error during nonce check', redisError);
      // In production, you might want to fail closed (throw error)
      // For now, we'll continue but log the issue
    }
    
    // Generate expected signature
    const expectedSignature = this.generateSignature(
      req.method,
      req.originalUrl || req.path,
      requestTime,
      nonce,
      includeBody ? req.body : null,
      secret,
      { algorithm, includeBody }
    );
    
    // Compare signatures
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    if (!isValid) {
      logger.warn('Invalid signature', {
        path: req.path,
        method: req.method,
        providedSignature: signature.substring(0, 8) + '...',
        timestamp: requestTime,
        ip: req.ip
      });
    }
    
    return isValid;
  }
  
  /**
   * Generate request headers for signing
   */
  static generateSignatureHeaders(
    method: string,
    path: string,
    body: any,
    secret: string,
    options: SignatureOptions = {}
  ): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const signature = this.generateSignature(
      method,
      path,
      timestamp,
      nonce,
      body,
      secret,
      options
    );
    
    return {
      'X-Signature': signature,
      'X-Timestamp': timestamp.toString(),
      'X-Nonce': nonce
    };
  }
  
  /**
   * Sort object keys recursively for consistent signing
   */
  private static sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObject(item));
    }
    
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = this.sortObject(obj[key]);
    }
    
    return sorted;
  }
  
  /**
   * Create a signed URL with expiry
   */
  static createSignedUrl(
    url: string,
    secret: string,
    expirySeconds: number = 3600
  ): string {
    const urlObj = new URL(url);
    const expires = Math.floor(Date.now() / 1000) + expirySeconds;
    
    // Add expiry to query params
    urlObj.searchParams.set('expires', expires.toString());
    
    // Create signature
    const stringToSign = `${urlObj.pathname}${urlObj.search}:${expires}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('hex');
    
    // Add signature to URL
    urlObj.searchParams.set('signature', signature);
    
    return urlObj.toString();
  }
  
  /**
   * Validate a signed URL
   */
  static validateSignedUrl(url: string, secret: string): boolean {
    try {
      const urlObj = new URL(url);
      const expires = urlObj.searchParams.get('expires');
      const signature = urlObj.searchParams.get('signature');
      
      if (!expires || !signature) {
        return false;
      }
      
      const expiryTime = parseInt(expires);
      const now = Math.floor(Date.now() / 1000);
      
      // Check if expired
      if (now > expiryTime) {
        return false;
      }
      
      // Remove signature from URL for validation
      urlObj.searchParams.delete('signature');
      
      // Recreate signature
      const stringToSign = `${urlObj.pathname}${urlObj.search}:${expires}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(stringToSign)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      logger.error('Error validating signed URL', error);
      return false;
    }
  }
}