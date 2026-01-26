-- Fix campaign_metrics unique constraint for upsert operations
-- The partial index (WHERE organization_id IS NOT NULL) doesn't work with Supabase upsert
-- Need a full unique constraint instead

-- Drop the partial unique index
DROP INDEX IF EXISTS idx_campaign_metrics_unique;

-- Create a full unique constraint (without WHERE clause)
CREATE UNIQUE INDEX idx_campaign_metrics_unique
  ON campaign_metrics(organization_id, platform_type, date, metric_type);

COMMENT ON INDEX idx_campaign_metrics_unique IS 'Unique constraint for campaign metrics upsert operations. Allows duplicate prevention across org, platform, date, and metric type.';
