-- Migration: Create email delivery logs table
-- Purpose: Track email delivery status and metrics for monitoring

-- Create table for email delivery logs
CREATE TABLE IF NOT EXISTS email_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id VARCHAR(255),
    provider VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_email_id ON email_delivery_logs (email_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_provider ON email_delivery_logs (provider);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs (status);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_timestamp ON email_delivery_logs (timestamp);

-- Add comment for documentation
COMMENT ON TABLE email_delivery_logs IS 'Tracks email delivery status and metrics for monitoring';
COMMENT ON COLUMN email_delivery_logs.email_id IS 'Unique identifier from email provider';
COMMENT ON COLUMN email_delivery_logs.provider IS 'Email provider used (resend, sendgrid, etc)';
COMMENT ON COLUMN email_delivery_logs.status IS 'Current delivery status';
COMMENT ON COLUMN email_delivery_logs.error IS 'Error message if delivery failed';
COMMENT ON COLUMN email_delivery_logs.metadata IS 'Additional metadata (fallback used, response time, etc)';