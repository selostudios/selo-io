-- Add unique constraint on campaign_metrics to prevent duplicate entries
-- This allows upsert behavior (update on conflict)

-- First, remove any duplicate entries (keep the most recent one by id)
DELETE FROM campaign_metrics a
USING campaign_metrics b
WHERE a.id < b.id
  AND a.organization_id = b.organization_id
  AND a.platform_type = b.platform_type
  AND a.date = b.date
  AND a.metric_type = b.metric_type;

-- Now add the unique constraint
CREATE UNIQUE INDEX idx_campaign_metrics_unique
  ON campaign_metrics(organization_id, platform_type, date, metric_type)
  WHERE organization_id IS NOT NULL;
