-- Performance optimization indexes for critical repositories
-- Story 3.2.2: Critical Repositories Migration

-- Card queries optimization
CREATE INDEX IF NOT EXISTS idx_virtual_cards_user_status 
ON virtual_cards(user_id, status) 
WHERE status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_virtual_cards_token 
ON virtual_cards(card_token);

CREATE INDEX IF NOT EXISTS idx_virtual_cards_admediacards_id 
ON virtual_cards(admediacards_card_id);

CREATE INDEX IF NOT EXISTS idx_virtual_cards_created_at 
ON virtual_cards(created_at DESC);

-- Transaction queries optimization
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
ON transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_card_created 
ON transactions(card_id, created_at DESC) 
WHERE card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON transactions(status) 
WHERE status IN ('pending', 'disputed');

CREATE INDEX IF NOT EXISTS idx_transactions_admediacards_id 
ON transactions(admediacards_transaction_id) 
WHERE admediacards_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_amount 
ON transactions(amount) 
WHERE status = 'completed';

-- Version fields for optimistic locking
ALTER TABLE virtual_cards 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- Update existing records to have version 0
UPDATE virtual_cards SET version = 0 WHERE version IS NULL;
UPDATE transactions SET version = 0 WHERE version IS NULL;

-- Add NOT NULL constraint after update
ALTER TABLE virtual_cards ALTER COLUMN version SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN version SET NOT NULL;

-- Add indexes for version-based queries (optimistic locking)
CREATE INDEX IF NOT EXISTS idx_virtual_cards_version 
ON virtual_cards(id, version);

CREATE INDEX IF NOT EXISTS idx_transactions_version 
ON transactions(id, version);

-- Connection pool optimization hints
COMMENT ON INDEX idx_virtual_cards_user_status IS 'Most common query pattern for user cards';
COMMENT ON INDEX idx_transactions_user_created IS 'Transaction history queries';
COMMENT ON INDEX idx_virtual_cards_token IS 'Card token lookups for webhooks';