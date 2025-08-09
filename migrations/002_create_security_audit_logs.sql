-- Migration: Create Security Audit Logs Table
-- Date: 2025-08-09
-- Description: Creates security audit logs table for comprehensive 2FA monitoring and anomaly detection

-- Create security_audit_logs table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    '2fa_setup', '2fa_enabled', '2fa_disabled', '2fa_verified', '2fa_failed',
    'backup_code_used', 'backup_codes_regenerated', 'recovery_initiated',
    'recovery_completed', 'suspicious_activity'
  )),
  event_category TEXT NOT NULL DEFAULT 'two_factor_authentication',
  event_details JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON public.security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_timestamp ON public.security_audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_timestamp ON public.security_audit_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_category_timestamp ON public.security_audit_logs(event_category, timestamp);

-- Create composite index for anomaly detection queries
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_category_timestamp 
  ON public.security_audit_logs(user_id, event_category, timestamp);

-- Create GIN index for JSONB columns for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_details ON public.security_audit_logs USING gin (event_details);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_metadata ON public.security_audit_logs USING gin (metadata);

-- Add table and column documentation
COMMENT ON TABLE public.security_audit_logs IS 'Comprehensive audit log for security events including 2FA activities and anomaly detection';
COMMENT ON COLUMN public.security_audit_logs.event_type IS 'Type of security event that occurred';
COMMENT ON COLUMN public.security_audit_logs.event_category IS 'Category of the security event (e.g., two_factor_authentication)';
COMMENT ON COLUMN public.security_audit_logs.event_details IS 'JSON object containing detailed event information';
COMMENT ON COLUMN public.security_audit_logs.ip_address IS 'IP address from which the event originated';
COMMENT ON COLUMN public.security_audit_logs.user_agent IS 'User agent string of the client';
COMMENT ON COLUMN public.security_audit_logs.metadata IS 'Additional metadata about the event for analytics';