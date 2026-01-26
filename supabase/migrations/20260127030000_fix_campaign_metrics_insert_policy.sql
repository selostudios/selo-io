-- Fix missing INSERT policy for campaign_metrics
-- The policy was dropped in 20260124000002 but never recreated

-- Add INSERT policy for campaign_metrics
-- Allows users to insert metrics for their own organization
CREATE POLICY "Users can insert metrics for their organization"
  ON campaign_metrics FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
  );

COMMENT ON POLICY "Users can insert metrics for their organization" ON campaign_metrics
  IS 'Allows users to sync platform metrics for their organization via dashboard';
