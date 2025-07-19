import dotenv from 'dotenv';
  dotenv.config();
  
  // Initialize Sentry before other imports for better error tracking
  import { initializeSentry } from './config/sentry';
  initializeSentry();
  
  import express from 'express';
  import cors from 'cors';
  import helmet from 'helmet';
  import compression from 'compression';
  import morgan from 'morgan';
  import cookieParser from 'cookie-parser';
  import { env } from './config/env';
  import { testDatabaseConnection } from './config/database';
  import { requestId } from './api/middlewares/requestId';
  import { errorHandler } from './api/middlewares/errorHandler';
  import { sentryRequestHandler, sentryErrorHandler } from './api/middlewares/sentryMiddleware';
  import { globalLimiter } from './api/middlewares/rateLimiter';
  import { csrfProtection } from './api/middlewares/csrf';
  import { sanitizeInput } from './api/middlewares/sanitize';
  import { auditLogger } from './api/middlewares/auditLogger';
  import { authenticate } from './api/middlewares/auth';
  import { authorize } from './api/middlewares/authorize';
  import { validate } from './api/middlewares/validate';
  import { CardController } from './api/controllers/cardController';
  import { getSecureCardDetailsSchema } from './api/validators/cardValidators';
  import { PERMISSIONS } from './config/roles';
  import logger from './utils/logger';
  import { sendSuccess } from './utils/responseFormatter';

  // Import routes
  import authRoutes from './api/routes/authRoutes';
  import userRoutes from './api/routes/userRoutes';
  import cardRoutes from './api/routes/cardRoutes';
  import transactionRoutes from './api/routes/transactionRoutes';
  import cryptoRoutes from './api/routes/cryptoRoutes';
  import webhookRoutes from './api/routes/webhookRoutes';
  import tierRoutes from './api/routes/tierRoutes';
  import invoiceRoutes from './api/routes/invoiceRoutes';
  import kycRoutes from './api/routes/kycRoutes';
  import announcementRoutes from './api/routes/announcementRoutes';
  import bullDashboard from './api/routes/bullDashboard';
  import docsRoutes from './api/routes/docsRoutes';

  // Import job workers
  import { startJobWorkers, stopJobWorkers } from './jobs';

  // Services will be imported dynamically as needed

  const app = express();

  // Sentry request handler (must be first)
  app.use(sentryRequestHandler());

  // Request ID middleware
  app.use(requestId);

  // Global rate limiter (early in the middleware chain)
  app.use(globalLimiter);

  // Security headers with enhanced configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://challenges.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", ...env.ALLOWED_ORIGINS.split(',')],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["https://challenges.cloudflare.com"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null
      }
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameguard: {
      action: 'deny'
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
  }));
  
  // Additional security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // Prevent caching of sensitive API data
    if (req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    
    // Remove fingerprinting headers
    res.removeHeader('X-Powered-By');
    
    next();
  });
  
  app.use(cors({
    origin: env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers choke on 204
  }));
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan('combined'));
  
  // Security middleware - sanitize all input
  app.use(sanitizeInput);
  
  // Audit logging middleware
  app.use(auditLogger());

  // Health check endpoint
  app.get('/health', async (_req, res) => {
    const dbConnected = await testDatabaseConnection();
    sendSuccess(res, {
      status: 'ok',
      environment: env.NODE_ENV,
      database: dbConnected ? 'connected' : 'disconnected'
    });
  });

  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', csrfProtection, userRoutes);
  app.use('/api/v1/cards', csrfProtection, cardRoutes);
  app.use('/api/v1/transactions', csrfProtection, transactionRoutes);
  app.use('/api/v1/crypto', csrfProtection, cryptoRoutes);
  app.use('/api/v1/tiers', csrfProtection, tierRoutes);
  app.use('/api/v1/invoices', csrfProtection, invoiceRoutes);
  app.use('/api/v1/kyc', csrfProtection, kycRoutes);
  app.use('/api/v1/announcements', csrfProtection, announcementRoutes);
  
  // Webhook routes (no /api/v1 prefix, mounted directly, no CSRF)
  app.use('/webhooks', webhookRoutes);
  
  // Admin dashboard for monitoring queues (protected by auth)
  app.use('/admin/queues', bullDashboard);
  
  // API Documentation (Swagger UI)
  app.use('/api/docs', docsRoutes);

  // Special secure endpoint expected by frontend
  app.post('/api/v1/secure/card-details',
    csrfProtection,
    authenticate,
    authorize(PERMISSIONS.CARDS_READ),
    validate(getSecureCardDetailsSchema),
    CardController.getSecureCardDetails
  );

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found'
      }
    });
  });

  // Sentry error handler (must be before other error handlers)
  app.use(sentryErrorHandler());
  
  // Error handler (should be last) - Express error handlers need 4 parameters
  app.use(errorHandler as express.ErrorRequestHandler);

  // Start server
  async function startServer() {
    try {
      // Force Railway rebuild - remove this comment after deploy
      // Test database connection
      await testDatabaseConnection();

      // Log email provider status
      const { emailProvider } = await import('./services/emailProvider');
      logger.info(`✅ Email service initialized with provider: ${emailProvider.getActiveProvider()}`);

      // Start job workers
      await startJobWorkers();

      const PORT = env.PORT || 3001;
      app.listen(PORT, () => {
        logger.info(`🚀 Server running on port ${PORT} in ${env.NODE_ENV} mode`);
        logger.info(`Auth endpoints available at: http://localhost:${PORT}/api/v1/auth`);
        logger.info(`User endpoints available at: http://localhost:${PORT}/api/v1/users`);
        logger.info(`Card endpoints available at: http://localhost:${PORT}/api/v1/cards`);
        logger.info(`Transaction endpoints available at: http://localhost:${PORT}/api/v1/transactions`);
        logger.info(`Crypto endpoints available at: http://localhost:${PORT}/api/v1/crypto`);
        logger.info(`Tier endpoints available at: http://localhost:${PORT}/api/v1/tiers`);
        logger.info(`Invoice endpoints available at: http://localhost:${PORT}/api/v1/invoices`);
        logger.info(`KYC endpoints available at: http://localhost:${PORT}/api/v1/kyc`);
        logger.info(`Announcement endpoints available at: http://localhost:${PORT}/api/v1/announcements`);
        logger.info(`Webhook endpoint available at: http://localhost:${PORT}/webhooks/xmoney`);
        logger.info(`KYC webhook available at: http://localhost:${PORT}/api/v1/kyc/webhook`);
        logger.info(`✅ Background job workers started`);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    await stopJobWorkers();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT signal received: closing HTTP server');
    await stopJobWorkers();
    process.exit(0);
  });

  startServer();