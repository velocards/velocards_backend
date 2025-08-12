#!/bin/bash

echo "🏗️  Production Build Script"
echo "========================="

# Check if we're in production mode
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  Warning: NODE_ENV is not set to 'production'"
    echo "Setting NODE_ENV=production for this build..."
    export NODE_ENV=production
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Remove test files that shouldn't be in production
echo "🔒 Removing test files..."
rm -f jest.setup.js
rm -rf src/__mocks__
rm -rf **/__mocks__

# Build the project
echo "🔨 Building project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Remove test files from dist if they somehow got there
echo "🔍 Cleaning dist directory..."
find dist -name "*.test.js" -delete
find dist -name "*.spec.js" -delete
find dist -name "*.test.d.ts" -delete
find dist -name "*.spec.d.ts" -delete
find dist -name "__mocks__" -type d -exec rm -rf {} + 2>/dev/null

# Remove old repository files if feature flag is set
if [ "$USE_NEW_REPOSITORIES" == "true" ]; then
    echo "🔄 New repositories enabled - removing old implementations..."
    find dist -name "*.old.js" -delete
    find dist -name "*.old.d.ts" -delete
fi

echo "✅ Production build complete!"
echo ""
echo "📋 Pre-deployment checklist:"
echo "  [ ] Run database migrations"
echo "  [ ] Set feature flags in environment"
echo "  [ ] Test with production-like environment"
echo "  [ ] Review MIGRATION_SAFETY.md"
echo ""
echo "🚀 Ready for deployment!"