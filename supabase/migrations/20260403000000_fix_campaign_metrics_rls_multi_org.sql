-- Fix campaign_metrics RLS policies to support multi-org users.
-- Previous policies used get_user_organization_id() which returns only
-- the first org (LIMIT 1), blocking inserts/reads for secondary orgs.

-- Drop old single-org policies
DROP POLICY IF EXISTS "Users can insert org-level metrics" ON public.campaign_metrics;
DROP POLICY IF EXISTS "Users can insert metrics for their organization" ON public.campaign_metrics;
DROP POLICY IF EXISTS "Users can view metrics in their organization" ON public.campaign_metrics;

-- Drop new policies too in case they were applied manually before this migration
DROP POLICY IF EXISTS "Users can insert metrics for their organizations" ON public.campaign_metrics;
DROP POLICY IF EXISTS "Users can view metrics in their organizations" ON public.campaign_metrics;

-- Create multi-org INSERT policy
CREATE POLICY "Users can insert metrics for their organizations" ON public.campaign_metrics
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT tm.organization_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
    )
    OR (SELECT public.is_internal_user())
  );

-- Create multi-org SELECT policy
CREATE POLICY "Users can view metrics in their organizations" ON public.campaign_metrics
  FOR SELECT
  USING (
    organization_id IN (
      SELECT tm.organization_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
    )
    OR (SELECT public.is_internal_user())
  );
