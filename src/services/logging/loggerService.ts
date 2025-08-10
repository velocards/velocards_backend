import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { logging } from '../../config/env';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Create daily rotate transport for all logs
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Create daily rotate transport for error logs
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Create daily rotate transport for security logs
const securityRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '90d', // Keep security logs for 90 days
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
    let msg = `${timestamp} [${level}]`;
    if (correlationId) {
      msg += ` [${correlationId}]`;
    }
    msg += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

// Create the main logger
export const logger = winston.createLogger({
  level: logging.level || 'info',
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'velocards-api' },
  transports: [
    dailyRotateTransport,
    errorRotateTransport
  ]
});

// Add console transport in non-production environments
if (process.env['NODE_ENV'] !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create security logger
export const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'velocards-security' },
  transports: [
    securityRotateTransport
  ]
});

// Add console transport for security logger in non-production
if (process.env['NODE_ENV'] !== 'production') {
  securityLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Correlation ID middleware helper
export class CorrelationId {
  private static storage = new Map<string, string>();

  static generate(): string {
    return uuidv4();
  }

  static set(id: string, correlationId: string): void {
    this.storage.set(id, correlationId);
  }

  static get(id: string): string | undefined {
    return this.storage.get(id);
  }

  static delete(id: string): void {
    this.storage.delete(id);
  }
}

// Enhanced logging methods
export class LoggerService {
  private correlationId: string | undefined;

  constructor(correlationId?: string) {
    this.correlationId = correlationId;
  }

  private formatMessage(level: string, message: string, meta?: any): void {
    const logData = {
      correlationId: this.correlationId,
      ...meta
    };

    switch (level) {
      case 'error':
        logger.error(message, logData);
        break;
      case 'warn':
        logger.warn(message, logData);
        break;
      case 'info':
        logger.info(message, logData);
        break;
      case 'http':
        logger.http(message, logData);
        break;
      case 'debug':
        logger.debug(message, logData);
        break;
    }
  }

  error(message: string, error?: Error | any, meta?: any): void {
    const errorMeta = {
      ...meta,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };
    this.formatMessage('error', message, errorMeta);
  }

  warn(message: string, meta?: any): void {
    this.formatMessage('warn', message, meta);
  }

  info(message: string, meta?: any): void {
    this.formatMessage('info', message, meta);
  }

  http(message: string, meta?: any): void {
    this.formatMessage('http', message, meta);
  }

  debug(message: string, meta?: any): void {
    this.formatMessage('debug', message, meta);
  }

  // Security-specific logging
  security(eventType: string, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL', meta?: any): void {
    const securityMeta = {
      eventType,
      severity,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      ...meta
    };

    securityLogger.info(`Security Event: ${eventType}`, securityMeta);

    // Also log to main logger if high severity
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      this.formatMessage('error', `SECURITY ALERT: ${eventType}`, securityMeta);
    }
  }

  // Audit logging
  audit(action: string, resourceType?: string, resourceId?: string, meta?: any): void {
    const auditMeta = {
      action,
      resourceType,
      resourceId,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      ...meta
    };

    this.formatMessage('info', `AUDIT: ${action}`, auditMeta);
  }
}

// Export a default instance
export default new LoggerService();