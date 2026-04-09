-- Add feature column to usage_logs for product-area cost tracking
ALTER TABLE usage_logs ADD COLUMN feature TEXT;

-- Backfill existing rows based on event_type
UPDATE usage_logs SET feature = 'site_audit'
  WHERE event_type IN ('ai_analysis', 'psi_fetch');

UPDATE usage_logs SET feature = 'client_reports'
  WHERE event_type = 'summary_generation';

-- Index for feature-based cost queries
CREATE INDEX idx_usage_logs_feature_org
  ON usage_logs (feature, organization_id, created_at DESC);
