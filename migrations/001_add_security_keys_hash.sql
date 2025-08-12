-- Migration: Add key_hash column to security_keys table
-- Date: 2024
-- Description: Adds hash storage for API keys to improve security

-- Add the column if it doesn't exist
ALTER TABLE security_keys 
ADD COLUMN IF NOT EXISTS key_hash VARCHAR(255);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_security_keys_key_hash 
ON security_keys(key_hash);

-- Add comment for documentation
COMMENT ON COLUMN security_keys.key_hash IS 'Bcrypt hash of the API key for secure validation';