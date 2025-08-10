-- Migration: Add setup_initiated_at column to two_factor_auth table
-- Date: 2025-08-10
-- Description: Adds column to track when 2FA setup was initiated for expiry validation

-- Add setup_initiated_at column to two_factor_auth table
ALTER TABLE public.two_factor_auth 
ADD COLUMN IF NOT EXISTS setup_initiated_at TIMESTAMP WITH TIME ZONE;

-- Add comment documentation
COMMENT ON COLUMN public.two_factor_auth.setup_initiated_at IS 'Timestamp when 2FA setup was initiated, used for expiry validation';