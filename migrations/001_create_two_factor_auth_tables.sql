-- Migration: Create Two-Factor Authentication Tables
-- Date: 2025-08-09
-- Description: Creates tables for 2FA implementation including TOTP secrets, backup codes, and enhanced session management

-- Create two_factor_auth table in public schema
CREATE TABLE IF NOT EXISTS public.two_factor_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL, -- Encrypted TOTP secret
  backup_codes TEXT[] NOT NULL, -- Array of encrypted backup codes
  is_enabled BOOLEAN DEFAULT false,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_sessions table for enhanced session management
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_fingerprint TEXT,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  two_fa_verified BOOLEAN DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_two_factor_auth_user_id ON public.two_factor_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_auth_is_enabled ON public.two_factor_auth(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON public.user_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create account_recovery_requests table for 2FA recovery
CREATE TABLE IF NOT EXISTS public.account_recovery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for account recovery
CREATE INDEX IF NOT EXISTS idx_account_recovery_token_hash ON public.account_recovery_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_account_recovery_user_id ON public.account_recovery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_recovery_expires ON public.account_recovery_requests(expires_at);

-- Create trigger for two_factor_auth table
CREATE TRIGGER update_two_factor_auth_updated_at 
  BEFORE UPDATE ON public.two_factor_auth
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment documentation
COMMENT ON TABLE public.two_factor_auth IS 'Stores 2FA configuration for users including TOTP secrets and backup codes';
COMMENT ON COLUMN public.two_factor_auth.secret IS 'Encrypted TOTP secret for generating time-based codes';
COMMENT ON COLUMN public.two_factor_auth.backup_codes IS 'Array of encrypted single-use backup codes';
COMMENT ON COLUMN public.two_factor_auth.is_enabled IS 'Whether 2FA is currently active for the user';

COMMENT ON TABLE public.user_sessions IS 'Enhanced session management with device tracking and 2FA state';
COMMENT ON COLUMN public.user_sessions.device_fingerprint IS 'Unique identifier for user device/browser';
COMMENT ON COLUMN public.user_sessions.two_fa_verified IS 'Whether this session has completed 2FA verification';

COMMENT ON TABLE public.account_recovery_requests IS 'Stores account recovery requests for 2FA reset';
COMMENT ON COLUMN public.account_recovery_requests.token_hash IS 'SHA256 hash of the recovery token';
COMMENT ON COLUMN public.account_recovery_requests.used IS 'Whether this recovery token has been used';