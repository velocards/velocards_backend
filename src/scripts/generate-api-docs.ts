#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

// This script generates comprehensive API documentation by analyzing existing routes

const apiEndpoints = {
  auth: [
    { method: 'POST', path: '/register', description: 'Register new user account' },
    { method: 'POST', path: '/login', description: 'Login with email and password' },
    { method: 'POST', path: '/refresh', description: 'Refresh access token' },
    { method: 'POST', path: '/logout', description: 'Logout and invalidate tokens' },
    { method: 'POST', path: '/forgot-password', description: 'Request password reset' },
    { method: 'POST', path: '/reset-password', description: 'Reset password with token' },
    { method: 'POST', path: '/verify-email', description: 'Verify email address' },
    { method: 'GET', path: '/google', description: 'Start Google OAuth flow' },
    { method: 'GET', path: '/google/callback', description: 'Google OAuth callback' }
  ],
  users: [
    { method: 'GET', path: '/profile', description: 'Get user profile' },
    { method: 'PATCH', path: '/profile', description: 'Update user profile' },
    { method: 'POST', path: '/change-password', description: 'Change password' },
    { method: 'GET', path: '/balance', description: 'Get user balance' },
    { method: 'GET', path: '/statistics', description: 'Get user statistics' },
    { method: 'POST', path: '/complete-profile', description: 'Complete profile setup' }
  ],
  cards: [
    { method: 'GET', path: '/', description: 'List all user cards' },
    { method: 'POST', path: '/', description: 'Create new virtual card' },
    { method: 'GET', path: '/:cardId', description: 'Get card details' },
    { method: 'POST', path: '/:cardId/freeze', description: 'Freeze card' },
    { method: 'POST', path: '/:cardId/unfreeze', description: 'Unfreeze card' },
    { method: 'POST', path: '/:cardId/disable', description: 'Disable card permanently' },
    { method: 'PATCH', path: '/:cardId/limit', description: 'Update spending limit' },
    { method: 'GET', path: '/:cardId/transactions', description: 'Get card transactions' }
  ],
  transactions: [
    { method: 'GET', path: '/', description: 'Get transaction history' },
    { method: 'GET', path: '/:transactionId', description: 'Get transaction details' },
    { method: 'POST', path: '/:transactionId/dispute', description: 'Dispute transaction' },
    { method: 'GET', path: '/export', description: 'Export transactions' },
    { method: 'GET', path: '/stats', description: 'Get transaction statistics' }
  ],
  crypto: [
    { method: 'POST', path: '/deposit', description: 'Create crypto deposit order' },
    { method: 'GET', path: '/deposits', description: 'Get deposit history' },
    { method: 'GET', path: '/rates', description: 'Get exchange rates' },
    { method: 'GET', path: '/order/:orderId', description: 'Get order status' }
  ],
  tiers: [
    { method: 'GET', path: '/', description: 'Get all tier levels' },
    { method: 'GET', path: '/current', description: 'Get user current tier' },
    { method: 'GET', path: '/history', description: 'Get tier upgrade history' },
    { method: 'GET', path: '/features', description: 'Get tier features' }
  ]
};

// Generate markdown documentation
function generateMarkdownDocs() {
  let markdown = `# VeloCards API Documentation

## Base URL
- Production: \`https://api.velocards.com/api/v1\`
- Development: \`http://localhost:3001/api/v1\`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting
- Default: 300 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- Card creation: 5 requests per minute

## API Endpoints

`;

  Object.entries(apiEndpoints).forEach(([category, endpoints]) => {
    markdown += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Endpoints\n\n`;
    endpoints.forEach(endpoint => {
      markdown += `- **${endpoint.method}** \`/api/v1/${category}${endpoint.path}\` - ${endpoint.description}\n`;
    });
    markdown += '\n';
  });

  return markdown;
}

const docsPath = path.join(__dirname, '../../API_DOCUMENTATION.md');
fs.writeFileSync(docsPath, generateMarkdownDocs());

console.log(`✅ API documentation generated at: ${docsPath}`);
console.log('📚 Swagger UI available at: http://localhost:3001/api/docs');
console.log('🚀 To regenerate OpenAPI spec: npm run swagger');