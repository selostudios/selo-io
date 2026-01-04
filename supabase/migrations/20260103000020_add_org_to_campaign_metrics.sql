-- Add organization_id to campaign_metrics for org-level metrics
ALTER TABLE campaign_metrics
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Make campaign_id nullable (org-level metrics don't have a campaign)
ALTER TABLE campaign_metrics
ALTER COLUMN campaign_id DROP NOT NULL;

-- Add index for org-level metric queries
CREATE INDEX idx_campaign_metrics_org ON campaign_metrics(organization_id);
CREATE INDEX idx_campaign_metrics_org_date ON campaign_metrics(organization_id, date);

-- Add RLS policy for org-level metrics
CREATE POLICY "Users can view org-level metrics"
  ON campaign_metrics FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
