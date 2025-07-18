# VeloCards API Documentation

## Base URL
- Production: `https://api.velocards.com/api/v1`
- Development: `http://localhost:3001/api/v1`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Rate Limiting
- Default: 300 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- Card creation: 5 requests per minute

## API Endpoints

### Auth Endpoints

- **POST** `/api/v1/auth/register` - Register new user account
- **POST** `/api/v1/auth/login` - Login with email and password
- **POST** `/api/v1/auth/refresh` - Refresh access token
- **POST** `/api/v1/auth/logout` - Logout and invalidate tokens
- **POST** `/api/v1/auth/forgot-password` - Request password reset
- **POST** `/api/v1/auth/reset-password` - Reset password with token
- **POST** `/api/v1/auth/verify-email` - Verify email address
- **GET** `/api/v1/auth/google` - Start Google OAuth flow
- **GET** `/api/v1/auth/google/callback` - Google OAuth callback

### Users Endpoints

- **GET** `/api/v1/users/profile` - Get user profile
- **PATCH** `/api/v1/users/profile` - Update user profile
- **POST** `/api/v1/users/change-password` - Change password
- **GET** `/api/v1/users/balance` - Get user balance
- **GET** `/api/v1/users/statistics` - Get user statistics
- **POST** `/api/v1/users/complete-profile` - Complete profile setup

### Cards Endpoints

- **GET** `/api/v1/cards/` - List all user cards
- **POST** `/api/v1/cards/` - Create new virtual card
- **GET** `/api/v1/cards/:cardId` - Get card details
- **POST** `/api/v1/cards/:cardId/freeze` - Freeze card
- **POST** `/api/v1/cards/:cardId/unfreeze` - Unfreeze card
- **POST** `/api/v1/cards/:cardId/disable` - Disable card permanently
- **PATCH** `/api/v1/cards/:cardId/limit` - Update spending limit
- **GET** `/api/v1/cards/:cardId/transactions` - Get card transactions

### Transactions Endpoints

- **GET** `/api/v1/transactions/` - Get transaction history
- **GET** `/api/v1/transactions/:transactionId` - Get transaction details
- **POST** `/api/v1/transactions/:transactionId/dispute` - Dispute transaction
- **GET** `/api/v1/transactions/export` - Export transactions
- **GET** `/api/v1/transactions/stats` - Get transaction statistics

### Crypto Endpoints

- **POST** `/api/v1/crypto/deposit` - Create crypto deposit order
- **GET** `/api/v1/crypto/deposits` - Get deposit history
- **GET** `/api/v1/crypto/rates` - Get exchange rates
- **GET** `/api/v1/crypto/order/:orderId` - Get order status

### Tiers Endpoints

- **GET** `/api/v1/tiers/` - Get all tier levels
- **GET** `/api/v1/tiers/current` - Get user current tier
- **GET** `/api/v1/tiers/history` - Get tier upgrade history
- **GET** `/api/v1/tiers/features` - Get tier features

