-- Migration: Create Rate Limit Tracking Table
-- Date: 2025-08-10
-- Description: Creates rate limit tracking table for monitoring and tier-based rate limiting

-- Create rate_limit_tracking table
CREATE TABLE IF NOT EXISTS public.rate_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address or user ID
  endpoint TEXT NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  request_count INTEGER DEFAULT 1,
  tier TEXT DEFAULT 'basic', -- basic, premium, enterprise
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_identifier ON public.rate_limit_tracking(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_window ON public.rate_limit_tracking(identifier, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_endpoint ON public.rate_limit_tracking(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_created ON public.rate_limit_tracking(created_at);

-- Add table documentation
COMMENT ON TABLE public.rate_limit_tracking IS 'Tracks rate limit usage for monitoring and tier-based limiting';
COMMENT ON COLUMN public.rate_limit_tracking.identifier IS 'IP address for anonymous users or user ID for authenticated users';
COMMENT ON COLUMN public.rate_limit_tracking.endpoint IS 'API endpoint being accessed';
COMMENT ON COLUMN public.rate_limit_tracking.window_start IS 'Start time of the rate limit window';
COMMENT ON COLUMN public.rate_limit_tracking.request_count IS 'Number of requests in current window';
COMMENT ON COLUMN public.rate_limit_tracking.tier IS 'User tier for tier-based rate limiting';