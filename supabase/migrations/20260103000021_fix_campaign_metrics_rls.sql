-- Fix RLS policy to use helper function instead of subquery
-- This prevents potential recursion issues and improves performance

-- Drop the policy created in previous migration
DROP POLICY IF EXISTS "Users can view org-level metrics" ON campaign_metrics;

-- Recreate using the helper function (established pattern in this codebase)
CREATE POLICY "Users can view org-level metrics"
  ON campaign_metrics FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
  );

-- Add INSERT policy for org-level metrics (server actions need to insert)
CREATE POLICY "Users can insert org-level metrics"
  ON campaign_metrics FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id()
  );
