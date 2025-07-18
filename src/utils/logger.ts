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
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          
          // If there are additional metadata, stringify it properly
          if (Object.keys(meta).length > 0) {
            // Remove the service key from meta since it's already in defaultMeta
            const { service, ...otherMeta } = meta;
            if (Object.keys(otherMeta).length > 0) {
              msg += ` ${JSON.stringify(otherMeta)}`;
            }
          }
          
          return msg;
        })
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

export default logger;