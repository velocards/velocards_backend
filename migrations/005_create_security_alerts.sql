-- Migration: Create Security Alerts Table
-- Date: 2025-08-10
-- Description: Creates security alerts table for tracking and managing security alerts

-- Create security_alerts table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('security', 'rate_limit', 'anomaly', 'system')),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  endpoint TEXT,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON public.security_alerts(type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_acknowledged ON public.security_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON public.security_alerts(user_id);

-- Add table documentation
COMMENT ON TABLE public.security_alerts IS 'Tracks security alerts and their acknowledgment status';
COMMENT ON COLUMN public.security_alerts.type IS 'Type of alert (security, rate_limit, anomaly, system)';
COMMENT ON COLUMN public.security_alerts.severity IS 'Alert severity level';
COMMENT ON COLUMN public.security_alerts.title IS 'Brief title of the alert';
COMMENT ON COLUMN public.security_alerts.message IS 'Detailed alert message';
COMMENT ON COLUMN public.security_alerts.details IS 'Additional alert details in JSON format';
COMMENT ON COLUMN public.security_alerts.acknowledged IS 'Whether the alert has been acknowledged';
COMMENT ON COLUMN public.security_alerts.acknowledged_by IS 'User who acknowledged the alert';
COMMENT ON COLUMN public.security_alerts.acknowledged_at IS 'Timestamp when alert was acknowledged';