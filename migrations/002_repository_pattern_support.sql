-- Migration: Repository Pattern Support
-- Date: 2025-08-11
-- Description: Adds support for repository pattern features including optimistic locking and atomic operations

-- 1. Add version column to existing tables for optimistic locking
-- Only add to tables that exist in current schema
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE user_tiers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE user_balance_ledger ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Note: cards table will get version column when it's created in a future migration

-- 2. Create atomic balance transfer function for transaction support
CREATE OR REPLACE FUNCTION atomic_balance_transfer(
  from_user_id UUID,
  to_user_id UUID,
  amount DECIMAL,
  transaction_id UUID
) RETURNS JSON AS $$
DECLARE
  from_balance DECIMAL;
  result JSON;
BEGIN
  -- Lock the rows for update
  SELECT virtual_balance INTO from_balance
  FROM user_profiles
  WHERE id = from_user_id
  FOR UPDATE;

  IF from_balance < amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Update sender balance
  UPDATE user_profiles
  SET virtual_balance = virtual_balance - amount,
      updated_at = NOW(),
      version = version + 1
  WHERE id = from_user_id;

  -- Update receiver balance
  UPDATE user_profiles
  SET virtual_balance = virtual_balance + amount,
      updated_at = NOW(),
      version = version + 1
  WHERE id = to_user_id;

  -- Log the transaction for sender
  INSERT INTO user_balance_ledger (
    id, user_id, transaction_type, amount,
    balance_before, balance_after, reference_type,
    description, created_at
  ) VALUES (
    gen_random_uuid(), from_user_id, 'transfer_out', amount,
    from_balance, from_balance - amount, 'transfer',
    'Transfer to ' || to_user_id, NOW()
  );

  -- Log the transaction for receiver
  INSERT INTO user_balance_ledger (
    id, user_id, transaction_type, amount,
    balance_before, balance_after, reference_type,
    description, created_at
  ) SELECT
    gen_random_uuid(), to_user_id, 'transfer_in', amount,
    virtual_balance - amount, virtual_balance, 'transfer',
    'Transfer from ' || from_user_id, NOW()
  FROM user_profiles
  WHERE id = to_user_id;

  result := json_build_object(
    'success', true,
    'transaction_id', transaction_id,
    'from_balance', from_balance - amount
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create index on version column for optimistic locking performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_version ON user_profiles(id, version);
CREATE INDEX IF NOT EXISTS idx_user_tiers_version ON user_tiers(id, version);

-- 4. Grant execute permissions to the service role (if role exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION atomic_balance_transfer TO service_role;
  END IF;
END $$;

-- 5. Add comments for documentation
COMMENT ON FUNCTION atomic_balance_transfer IS 'Atomic balance transfer between users with transaction support';
COMMENT ON COLUMN user_profiles.version IS 'Optimistic locking version for concurrent access control';
COMMENT ON COLUMN user_tiers.version IS 'Optimistic locking version for concurrent access control';
COMMENT ON COLUMN user_balance_ledger.version IS 'Optimistic locking version for concurrent access control';

-- Note: When cards table is created in future, remember to:
-- 1. Add version INTEGER DEFAULT 1 column
-- 2. Create index on (id, version)
-- 3. Add the atomic_card_funding function