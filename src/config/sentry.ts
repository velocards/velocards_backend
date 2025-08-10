import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { env } from './env';

export function initializeSentry() {
  if (!env.SENTRY_DSN) {
    console.log('Sentry DSN not configured, skipping initialization');
    return;
  }

  console.log('Initializing Sentry with DSN:', env.SENTRY_DSN.substring(0, 20) + '...');

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    integrations: [
      // Add profiling integration
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in production, 100% in development
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: 1.0,
    
    // Release tracking
    release: env.SENTRY_RELEASE || 'unknown',
    
    // Configure error filtering
    beforeSend(event, hint) {
      // Filter out non-error logs in production
      if (env.NODE_ENV === 'production') {
        const error = hint.originalException as any;
        
        // Don't send validation errors to Sentry
        if (error && error.name === 'ValidationError') {
          return null;
        }
      }
      
      // Remove sensitive data
      if (event.request) {
        // Remove authorization headers
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }
        
        // Remove sensitive body fields
        if (event.request.data && typeof event.request.data === 'object') {
          const data = event.request.data as any;
          const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'cvv'];
          sensitiveFields.forEach(field => {
            if (data[field]) {
              data[field] = '[REDACTED]';
            }
          });
        }
      }
      
      return event;
    },
    
    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      
      // Sanitize breadcrumb data
      if (breadcrumb.data && typeof breadcrumb.data === 'object') {
        const data = breadcrumb.data as any;
        const sensitiveKeys = ['password', 'token', 'authorization'];
        sensitiveKeys.forEach(key => {
          if (data[key]) {
            data[key] = '[REDACTED]';
          }
        });
      }
      
      return breadcrumb;
    },
  });
  
  console.log('✅ Sentry initialized successfully for', env.NODE_ENV, 'environment');
}

// Helper to capture user context
export function setSentryUser(user: { id: string; email?: string; tier?: string }) {
  const sentryUser: any = {
    id: user.id,
  };
  
  if (user.email) {
    sentryUser.email = user.email;
  }
  
  if (user.tier) {
    sentryUser.tier = user.tier;
  }
  
  Sentry.setUser(sentryUser);
}

// Helper to clear user context on logout
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Helper to add extra context to errors
export function addSentryContext(key: string, context: any) {
  Sentry.setContext(key, context);
}

// Helper to capture security events
export function captureSecurityEvent(
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any
) {
  const level = severity === 'critical' ? 'error' : 
                severity === 'high' ? 'warning' : 'info';
  
  Sentry.captureMessage(`Security Event: ${eventType}`, {
    level: level as any,
    tags: {
      security_event: 'true',
      event_type: eventType,
      event_severity: severity
    },
    contexts: {
      security: {
        event_type: eventType,
        severity,
        ...details
      }
    }
  });
  
  // Add breadcrumb for security event
  Sentry.addBreadcrumb({
    category: 'security',
    message: `Security event: ${eventType}`,
    level: level as any,
    data: details
  });
}

// Helper to capture anomaly detection
export function captureAnomaly(
  anomalyType: string,
  userId?: string,
  details?: any
) {
  Sentry.captureMessage(`Anomaly Detected: ${anomalyType}`, {
    level: 'warning',
    tags: {
      anomaly_type: anomalyType,
      security_event: 'true'
    },
    contexts: {
      anomaly: {
        type: anomalyType,
        user_id: userId,
        ...details
      }
    }
  });
}

// Helper to capture rate limit violations
export function captureRateLimitViolation(
  identifier: string,
  endpoint: string,
  requestCount: number,
  maxRequests: number
) {
  Sentry.captureMessage('Rate Limit Violation', {
    level: 'warning',
    tags: {
      security_event: 'true',
      event_type: 'rate_limit_violation'
    },
    contexts: {
      rate_limit: {
        identifier,
        endpoint,
        request_count: requestCount,
        max_requests: maxRequests,
        exceeded_by: requestCount - maxRequests
      }
    }
  });
}