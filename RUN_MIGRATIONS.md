# Database Migrations to Run

After restarting with Supabase MCP connected, run these SQL queries:

## 1. Check current security_keys schema
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'security_keys';
```

## 2. Add key_hash column to security_keys
```sql
ALTER TABLE security_keys 
ADD COLUMN IF NOT EXISTS key_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_security_keys_key_hash 
ON security_keys(key_hash);
```

## 3. Check if crypto_prices exists
```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'crypto_prices'
);
```

## 4. Create crypto_prices table
```sql
CREATE TABLE IF NOT EXISTS crypto_prices (
  id VARCHAR(255) PRIMARY KEY,
  currency VARCHAR(10) NOT NULL,
  price DECIMAL(20, 8) NOT NULL,
  cached_at TIMESTAMP NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crypto_prices_currency 
ON crypto_prices(currency);

CREATE INDEX IF NOT EXISTS idx_crypto_prices_cached_at 
ON crypto_prices(cached_at);

CREATE INDEX IF NOT EXISTS idx_crypto_prices_currency_cached 
ON crypto_prices(currency, cached_at DESC);
```

## After running migrations:
✅ The repository pattern changes will be safe to deploy
✅ No production breaking changes
✅ Use feature flags for gradual rollout