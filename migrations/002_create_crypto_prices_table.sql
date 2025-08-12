-- Migration: Create crypto_prices table
-- Date: 2024
-- Description: Creates table for caching cryptocurrency prices

CREATE TABLE IF NOT EXISTS crypto_prices (
  id VARCHAR(255) PRIMARY KEY,
  currency VARCHAR(10) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  cached_at TIMESTAMP NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_crypto_prices_currency 
ON crypto_prices(currency);

CREATE INDEX IF NOT EXISTS idx_crypto_prices_cached_at 
ON crypto_prices(cached_at);

-- Add composite index for currency lookups
CREATE INDEX IF NOT EXISTS idx_crypto_prices_currency_cached 
ON crypto_prices(currency, cached_at DESC);

-- Add comment for documentation
COMMENT ON TABLE crypto_prices IS 'Cache table for cryptocurrency prices with TTL support';