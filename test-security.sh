#!/bin/bash

# Security Test Runner Script
# This script runs the security test suite with proper environment configuration

echo "🔒 Running Security Test Suite..."
echo "================================"

# Export test environment
export NODE_ENV=test

# Load test environment variables
if [ -f .env.test ]; then
    export $(cat .env.test | grep -v '^#' | xargs)
    echo "✓ Test environment loaded"
else
    echo "❌ Error: .env.test file not found"
    exit 1
fi

# Run security tests
echo ""
echo "Running security header tests..."
npm test -- src/api/middlewares/__tests__/securityHeaders.test.ts --passWithNoTests

echo ""
echo "Running CSRF protection tests..."
npm test -- src/api/middlewares/__tests__/csrf.test.ts --passWithNoTests

echo ""
echo "Running XSS protection tests..."
npm test -- src/api/middlewares/__tests__/xss.test.ts --passWithNoTests

echo ""
echo "Running SQL injection prevention tests..."
npm test -- src/repositories/__tests__/sqlInjection.test.ts --passWithNoTests

echo ""
echo "================================"
echo "✅ Security test suite complete!"