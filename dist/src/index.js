"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const requestId_1 = require("./api/middlewares/requestId");
const errorHandler_1 = require("./api/middlewares/errorHandler");
const rateLimiter_1 = require("./api/middlewares/rateLimiter");
const logger_1 = __importDefault(require("./utils/logger"));
const responseFormatter_1 = require("./utils/responseFormatter");
// Import routes
const authRoutes_1 = __importDefault(require("./api/routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./api/routes/userRoutes"));
const cardRoutes_1 = __importDefault(require("./api/routes/cardRoutes"));
const transactionRoutes_1 = __importDefault(require("./api/routes/transactionRoutes"));
const cryptoRoutes_1 = __importDefault(require("./api/routes/cryptoRoutes"));
const webhookRoutes_1 = __importDefault(require("./api/routes/webhookRoutes"));
const tierRoutes_1 = __importDefault(require("./api/routes/tierRoutes"));
const invoiceRoutes_1 = __importDefault(require("./api/routes/invoiceRoutes"));
// Import job workers
const jobs_1 = require("./jobs");
// Services will be imported dynamically as needed
const app = (0, express_1.default)();
// Request ID middleware (should be first)
app.use(requestId_1.requestId);
// Global rate limiter (early in the middleware chain)
app.use(rateLimiter_1.globalLimiter);
// Basic middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: env_1.env.ALLOWED_ORIGINS.split(','),
    credentials: true
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use((0, morgan_1.default)('combined'));
// Health check endpoint
app.get('/health', async (_req, res) => {
    const dbConnected = await (0, database_1.testDatabaseConnection)();
    (0, responseFormatter_1.sendSuccess)(res, {
        status: 'ok',
        environment: env_1.env.NODE_ENV,
        database: dbConnected ? 'connected' : 'disconnected'
    });
});
// API Routes
app.use('/api/v1/auth', authRoutes_1.default);
app.use('/api/v1/users', userRoutes_1.default);
app.use('/api/v1/cards', cardRoutes_1.default);
app.use('/api/v1/transactions', transactionRoutes_1.default);
app.use('/api/v1/crypto', cryptoRoutes_1.default);
app.use('/api/v1/tiers', tierRoutes_1.default);
app.use('/api/v1/invoices', invoiceRoutes_1.default);
// Webhook routes (no /api/v1 prefix, mounted directly)
app.use('/webhooks', webhookRoutes_1.default);
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
// Error handler (should be last) - Express error handlers need 4 parameters
app.use(errorHandler_1.errorHandler);
// Start server
async function startServer() {
    try {
        // Test database connection
        await (0, database_1.testDatabaseConnection)();
        // Log email provider status
        const { emailProvider } = await Promise.resolve().then(() => __importStar(require('./services/emailProvider')));
        logger_1.default.info(`✅ Email service initialized with provider: ${emailProvider.getActiveProvider()}`);
        // Start job workers
        await (0, jobs_1.startJobWorkers)();
        const PORT = env_1.env.PORT || 3001;
        app.listen(PORT, () => {
            logger_1.default.info(`🚀 Server running on port ${PORT} in ${env_1.env.NODE_ENV} mode`);
            logger_1.default.info(`Auth endpoints available at: http://localhost:${PORT}/api/v1/auth`);
            logger_1.default.info(`User endpoints available at: http://localhost:${PORT}/api/v1/users`);
            logger_1.default.info(`Card endpoints available at: http://localhost:${PORT}/api/v1/cards`);
            logger_1.default.info(`Transaction endpoints available at: http://localhost:${PORT}/api/v1/transactions`);
            logger_1.default.info(`Crypto endpoints available at: http://localhost:${PORT}/api/v1/crypto`);
            logger_1.default.info(`Tier endpoints available at: http://localhost:${PORT}/api/v1/tiers`);
            logger_1.default.info(`Invoice endpoints available at: http://localhost:${PORT}/api/v1/invoices`);
            logger_1.default.info(`Webhook endpoint available at: http://localhost:${PORT}/webhooks/xmoney`);
            logger_1.default.info(`✅ Background job workers started`);
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.default.info('SIGTERM signal received: closing HTTP server');
    await (0, jobs_1.stopJobWorkers)();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.default.info('SIGINT signal received: closing HTTP server');
    await (0, jobs_1.stopJobWorkers)();
    process.exit(0);
});
startServer();
//# sourceMappingURL=index.js.map