import winston from 'winston';
import { logging } from '../config/env';

const logger = winston.createLogger({
  level: logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'velocards-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }: any) => {
          // Handle cases where message might be an object
          let messageStr = message;
          if (typeof message === 'object' && message !== null) {
            messageStr = JSON.stringify(message);
          } else if (message === undefined || message === null) {
            messageStr = 'undefined';
          }
          
          let msg = `${timestamp} [${level}]: ${messageStr}`;
          
          // If there are additional metadata, stringify it properly
          if (Object.keys(meta).length > 0) {
            // Remove the service key from meta since it's already in defaultMeta
            const { service, error, ...otherMeta } = meta;
            
            // Handle error objects specially
            if (error) {
              if (error instanceof Error && error.stack) {
                msg += `\n${error.stack}`;
              } else if (typeof error === 'object' && error !== null && 'stack' in error) {
                msg += `\n${error.stack}`;
              } else {
                msg += ` ${JSON.stringify(error)}`;
              }
            }
            
            if (Object.keys(otherMeta).length > 0) {
              msg += ` ${JSON.stringify(otherMeta)}`;
            }
          }
          
          return msg;
        })
      )
    }),
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: 'combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Wrap logger methods to catch problematic calls
const wrappedLogger = {
  ...logger,
  error: (message: any, ...meta: any[]) => {
    // Debug: Log the stack trace when we get an object as message
    if (typeof message === 'object' && message !== null && !(message instanceof Error)) {
      console.trace('WARNING: Object passed as message to logger.error:', message);
    }
    return logger.error(message, ...meta);
  },
  warn: (message: any, ...meta: any[]) => {
    if (typeof message === 'object' && message !== null) {
      console.trace('WARNING: Object passed as message to logger.warn:', message);
    }
    return logger.warn(message, ...meta);
  },
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger),
  verbose: logger.verbose.bind(logger),
  silly: logger.silly.bind(logger)
};

export default wrappedLogger;