#!/bin/bash
echo "Installing dependencies..."
npm ci --production=false

echo "Building TypeScript..."
npm run build

echo "Starting with PM2..."
pm2 start ecosystem.config.js

echo "Deployment complete!"
