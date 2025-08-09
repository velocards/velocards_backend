# VeloCards Backend API

## Overview

VeloCards Backend is a TypeScript/Express.js API service that powers the virtual credit card platform. It provides secure endpoints for card management, transactions, crypto operations, and user management.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js 5.x with TypeScript
- **Database**: Supabase (PostgreSQL)
- **Validation**: Zod with automatic type inference
- **Queue**: Bull/BullMQ with Redis
- **Authentication**: JWT with refresh tokens
- **Documentation**: TSOA + Swagger

## Key Features

- Virtual credit card issuance and management
- Crypto deposit/withdrawal operations
- KYC verification integration
- Transaction processing and history
- Multi-tier user system
- Real-time balance tracking
- Comprehensive audit logging

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations (if any)
npm run migrate
```

## Development

```bash
# Start development server with hot reload
npm run dev

# Run TypeScript compiler in watch mode
npm run typecheck -- --watch

# Run linter
npm run lint

# Format code
npm run format
```

## Validation System

This project uses **Zod** for all validation with automatic TypeScript type inference:

- **Location**: `/src/api/validators/`
- **Middleware**: `/src/api/middlewares/validate.ts`
- **Documentation**: `/docs/validation-guide.md`

### Example Usage

```typescript
// Define schema with validation
import { z } from 'zod';

export const createCardSchema = z.object({
  body: z.object({
    type: z.enum(['single_use', 'multi_use']),
    fundingAmount: z.number().positive().max(10000),
    // ... other fields
  })
});

// Type is automatically inferred
export type CreateCardInput = z.infer<typeof createCardSchema>['body'];
```

## Type System

All types are automatically inferred from Zod schemas:

- **Shared Types**: `/src/types/exported.ts`
- **Response Types**: `/src/api/types/responses.ts`
- **Documentation**: `/docs/type-sharing-guide.md`

Types are exported for use in the dashboard repository.

## API Documentation

Swagger documentation is auto-generated from TSOA decorators:

```bash
# Generate/update Swagger docs
npm run swagger

# Access docs at
http://localhost:3000/api-docs
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- user.test.ts
```

## Build & Deployment

```bash
# Build for production
npm run build

# Start production server
npm start

# Deploy to Railway
railway up
```

## Project Structure

```
src/
├── api/
│   ├── controllers/     # Request handlers
│   ├── middlewares/     # Express middleware
│   ├── routes/          # Route definitions
│   ├── validators/      # Zod validation schemas
│   └── types/          # Response type definitions
├── config/             # Configuration files
├── integrations/       # External service clients
├── jobs/              # Background job processors
├── repositories/      # Data access layer
├── services/          # Business logic
├── types/             # Exported TypeScript types
└── utils/             # Utility functions
```

## Environment Variables

Key environment variables (see `.env.example` for full list):

```env
# Database
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...

# Redis
REDIS_URL=redis://...

# JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# External Services
ADMEDIACARDS_API_KEY=...
XMONEY_API_KEY=...
SUMSUB_APP_TOKEN=...
```

## Key Integrations

- **AdMediaCards**: Virtual card issuance
- **xMoney**: Crypto payment processing
- **SumSub**: KYC verification
- **SendGrid**: Email delivery
- **Sentry**: Error tracking

## Performance

Recent improvements (Story 1.2):
- Validation performance improved by 15-30% with Zod
- ~85% test coverage achieved
- TypeScript strict mode enabled
- Response time < 200ms for most endpoints

## Security

- JWT authentication with HttpOnly refresh tokens
- Rate limiting on all endpoints
- Input validation on all requests
- CORS properly configured
- Helmet.js for security headers
- Comprehensive audit logging
- Request signing for sensitive operations

## Common Commands

```bash
# Database operations
npm run add-test-balance     # Add test balance to user

# Testing
npm run test:auth           # Test auth endpoints
npm run test:rate-limit     # Test rate limiting
npm run test:crypto-jobs    # Test crypto processors

# Maintenance
npm run clean              # Clean build directory
npm run check-test-cards   # Check test card status
```

## Documentation

- [Validation Guide](./docs/validation-guide.md) - Zod validation patterns
- [Type Sharing Guide](./docs/type-sharing-guide.md) - Cross-repo type sharing
- [Migration Guide](./docs/migration/joi-to-zod-guide.md) - Joi to Zod migration

## Troubleshooting

### Build Errors

```bash
# Clear build cache
npm run clean
rm -rf node_modules
npm install
npm run build
```

### Type Errors

```bash
# Check TypeScript compilation
npm run typecheck

# Regenerate API routes
npm run swagger:routes
```

### Database Issues

```bash
# Check Supabase connection
npx supabase status

# Reset local database
npx supabase db reset
```

## Contributing

1. Create feature branch from `main`
2. Follow TypeScript strict mode
3. Add Zod validation for new endpoints
4. Export types for dashboard use
5. Write tests for new features
6. Update Swagger documentation
7. Run `npm run lint` before committing

## License

Proprietary - VeloCards

## Support

For issues or questions, contact the backend team.