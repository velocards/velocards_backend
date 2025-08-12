-- Query Optimization Indexes for Repository Pattern
-- Created for Story 3.2.4: Optimization & Caching Layer

-- ============================================
-- USER QUERIES OPTIMIZATION
-- ============================================

-- Index for email lookups (most common user query)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email) 
WHERE deleted_at IS NULL;

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username 
ON users(username) 
WHERE deleted_at IS NULL AND username IS NOT NULL;

-- Index for active user queries
CREATE INDEX IF NOT EXISTS idx_users_active_status 
ON users(is_active, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for KYC status filtering
CREATE INDEX IF NOT EXISTS idx_users_kyc_status 
ON users(kyc_status, updated_at DESC) 
WHERE deleted_at IS NULL AND is_active = true;

-- Composite index for user verification queries
CREATE INDEX IF NOT EXISTS idx_users_verification 
ON users(is_verified, is_active, created_at DESC) 
WHERE deleted_at IS NULL;

-- ============================================
-- CARD QUERIES OPTIMIZATION
-- ============================================

-- Index for user's cards lookup (very frequent)
CREATE INDEX IF NOT EXISTS idx_cards_user_lookup 
ON cards(user_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for card hash lookups (unique lookups)
CREATE INDEX IF NOT EXISTS idx_cards_hash 
ON cards(card_number_hash) 
WHERE deleted_at IS NULL;

-- Index for active cards by type
CREATE INDEX IF NOT EXISTS idx_cards_active_type 
ON cards(status, card_type, created_at DESC) 
WHERE deleted_at IS NULL AND status = 'active';

-- Index for card expiry monitoring
CREATE INDEX IF NOT EXISTS idx_cards_expiry 
ON cards(expiry_date, status) 
WHERE deleted_at IS NULL AND status IN ('active', 'suspended');

-- Index for card balance queries
CREATE INDEX IF NOT EXISTS idx_cards_balance 
ON cards(user_id, available_balance) 
WHERE deleted_at IS NULL AND status = 'active';

-- ============================================
-- TRANSACTION QUERIES OPTIMIZATION
-- ============================================

-- Index for user transaction history (most common)
CREATE INDEX IF NOT EXISTS idx_transactions_user_history 
ON transactions(user_id, created_at DESC, status);

-- Index for card transaction history
CREATE INDEX IF NOT EXISTS idx_transactions_card_history 
ON transactions(card_id, created_at DESC, status) 
WHERE card_id IS NOT NULL;

-- Index for transaction status filtering
CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON transactions(status, created_at DESC);

-- Index for transaction type queries
CREATE INDEX IF NOT EXISTS idx_transactions_type 
ON transactions(transaction_type, status, created_at DESC);

-- Index for amount range queries
CREATE INDEX IF NOT EXISTS idx_transactions_amount 
ON transactions(amount, created_at DESC) 
WHERE status = 'completed';

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_transactions_date_range 
ON transactions(created_at DESC, user_id, status);

-- ============================================
-- BALANCE LEDGER OPTIMIZATION
-- ============================================

-- Index for user balance history
CREATE INDEX IF NOT EXISTS idx_balance_ledger_user 
ON user_balance_ledger(user_id, created_at DESC);

-- Index for transaction type filtering
CREATE INDEX IF NOT EXISTS idx_balance_ledger_type 
ON user_balance_ledger(user_id, transaction_type, created_at DESC);

-- Index for balance calculations
CREATE INDEX IF NOT EXISTS idx_balance_ledger_calc 
ON user_balance_ledger(user_id, balance_after, created_at DESC);

-- ============================================
-- AUDIT LOG OPTIMIZATION
-- ============================================

-- Index for audit log queries by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user 
ON audit_logs(user_id, created_at DESC);

-- Index for audit log queries by entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
ON audit_logs(entity_type, entity_id, created_at DESC);

-- Index for audit log action filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_action 
ON audit_logs(action, created_at DESC);

-- ============================================
-- SECURITY KEY OPTIMIZATION
-- ============================================

-- Index for API key lookups
CREATE INDEX IF NOT EXISTS idx_security_keys_lookup 
ON user_security_keys(key_hash, is_active) 
WHERE deleted_at IS NULL;

-- Index for user's keys
CREATE INDEX IF NOT EXISTS idx_security_keys_user 
ON user_security_keys(user_id, key_type, is_active) 
WHERE deleted_at IS NULL;

-- Index for key expiration
CREATE INDEX IF NOT EXISTS idx_security_keys_expiry 
ON user_security_keys(expires_at, is_active) 
WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

-- ============================================
-- CRYPTO PRICE OPTIMIZATION
-- ============================================

-- Index for latest crypto prices
CREATE INDEX IF NOT EXISTS idx_crypto_prices_latest 
ON crypto_prices(currency, created_at DESC);

-- Index for price history queries
CREATE INDEX IF NOT EXISTS idx_crypto_prices_history 
ON crypto_prices(currency, created_at DESC, source);

-- ============================================
-- CRYPTO TRANSACTION OPTIMIZATION
-- ============================================

-- Index for user crypto transactions
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_user 
ON crypto_transactions(user_id, created_at DESC, status);

-- Index for transaction hash lookups
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_hash 
ON crypto_transactions(transaction_hash) 
WHERE transaction_hash IS NOT NULL;

-- Index for pending crypto transactions
CREATE INDEX IF NOT EXISTS idx_crypto_transactions_pending 
ON crypto_transactions(status, created_at DESC) 
WHERE status IN ('pending', 'processing');

-- ============================================
-- SESSION OPTIMIZATION
-- ============================================

-- Index for active sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
ON user_sessions(user_id, is_active, expires_at) 
WHERE is_active = true;

-- Index for session token lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_token 
ON user_sessions(session_token) 
WHERE is_active = true;

-- ============================================
-- NOTIFICATION OPTIMIZATION
-- ============================================

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
ON notifications(user_id, is_read, created_at DESC) 
WHERE is_read = false;

-- Index for notification type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON notifications(user_id, notification_type, created_at DESC);

-- ============================================
-- STATISTICS AND MONITORING
-- ============================================

-- Create statistics for query planner optimization
ANALYZE users;
ANALYZE cards;
ANALYZE transactions;
ANALYZE user_balance_ledger;
ANALYZE audit_logs;
ANALYZE user_security_keys;
ANALYZE crypto_prices;
ANALYZE crypto_transactions;
ANALYZE user_sessions;
ANALYZE notifications;

-- ============================================
-- PERFORMANCE MONITORING VIEW
-- ============================================

-- Create a view for monitoring index usage
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'UNUSED'
        WHEN idx_scan < 100 THEN 'RARELY_USED'
        WHEN idx_scan < 1000 THEN 'MODERATELY_USED'
        ELSE 'FREQUENTLY_USED'
    END as usage_category
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Create a view for monitoring slow queries
CREATE OR REPLACE VIEW slow_query_stats AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    rows,
    100.0 * total_time / sum(total_time) OVER () AS percentage_of_total_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY mean_time DESC
LIMIT 20;

-- ============================================
-- MAINTENANCE COMMENTS
-- ============================================

COMMENT ON INDEX idx_users_email IS 'Primary index for user email lookups - most frequent query pattern';
COMMENT ON INDEX idx_cards_user_lookup IS 'Composite index for user card queries - optimized for user dashboard';
COMMENT ON INDEX idx_transactions_user_history IS 'Transaction history index - optimized for pagination';
COMMENT ON INDEX idx_balance_ledger_user IS 'Balance ledger index - critical for balance calculations';
COMMENT ON VIEW index_usage_stats IS 'Monitor index usage to identify unused or underutilized indexes';
COMMENT ON VIEW slow_query_stats IS 'Identify slow queries that need optimization';