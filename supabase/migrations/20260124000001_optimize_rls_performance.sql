-- Migration: Optimize RLS policy performance
-- Wraps auth.uid() calls in (SELECT ...) subqueries
-- to prevent per-row evaluation and improve query performance.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

-- Fix SELECT policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM users WHERE users.id = (SELECT auth.uid()))
  );

-- Fix INSERT policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Users can create their first organization" ON organizations;
CREATE POLICY "Users can create their first organization"
  ON organizations FOR INSERT
  WITH CHECK (
    -- User is authenticated
    (SELECT auth.uid()) IS NOT NULL
    AND (
      -- User doesn't have an organization yet
      NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = (SELECT auth.uid()) AND organization_id IS NOT NULL
      )
      OR
      -- OR user is already an admin (for future multi-org scenarios)
      EXISTS (
        SELECT 1 FROM users
        WHERE id = (SELECT auth.uid()) AND role = 'admin'
      )
    )
  );

-- Fix UPDATE policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
CREATE POLICY "Admins can update their organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- USERS TABLE
-- ============================================================================

-- Fix SELECT policy - wrap function calls in subquery
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    (organization_id IS NOT NULL AND organization_id = (SELECT public.get_user_organization_id()))
    OR id = (SELECT auth.uid())
  );

-- ============================================================================
-- CAMPAIGNS TABLE
-- ============================================================================

-- Fix SELECT policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Users can view campaigns in their organization" ON campaigns;
CREATE POLICY "Users can view campaigns in their organization"
  ON campaigns FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = (SELECT auth.uid()))
  );

-- ============================================================================
-- PLATFORM_CONNECTIONS TABLE
-- ============================================================================

-- Fix SELECT policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Users can view platform connections in their organization" ON platform_connections;
CREATE POLICY "Users can view platform connections in their organization"
  ON platform_connections FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = (SELECT auth.uid()))
  );

-- ============================================================================
-- CAMPAIGN_METRICS TABLE
-- ============================================================================

-- Fix SELECT policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Users can view metrics for campaigns in their organization" ON campaign_metrics;
CREATE POLICY "Users can view metrics for campaigns in their organization"
  ON campaign_metrics FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = (SELECT auth.uid()))
  );

-- ============================================================================
-- WEEKLY_SUMMARIES TABLE
-- ============================================================================

-- Fix SELECT policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Users can view summaries in their organization" ON weekly_summaries;
CREATE POLICY "Users can view summaries in their organization"
  ON weekly_summaries FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- ============================================================================
-- INVITES TABLE
-- ============================================================================

-- Fix policy - wrap auth.uid() in subquery
DROP POLICY IF EXISTS "Admins can manage invites in their organization" ON invites;
CREATE POLICY "Admins can manage invites in their organization"
  ON invites FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- SITE_AUDITS TABLE
-- ============================================================================

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users can view their organization's audits" ON site_audits;
CREATE POLICY "Users can view their organization's audits"
  ON site_audits FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- Fix INSERT policy
DROP POLICY IF EXISTS "Users can insert audits for their organization" ON site_audits;
CREATE POLICY "Users can insert audits for their organization"
  ON site_audits FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Users can update their organization's audits" ON site_audits;
CREATE POLICY "Users can update their organization's audits"
  ON site_audits FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- ============================================================================
-- PERFORMANCE_AUDITS TABLE
-- ============================================================================

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users can view their organization's performance audits" ON performance_audits;
CREATE POLICY "Users can view their organization's performance audits"
  ON performance_audits FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid())));

-- Fix INSERT policy
DROP POLICY IF EXISTS "Users can insert performance audits for their organization" ON performance_audits;
CREATE POLICY "Users can insert performance audits for their organization"
  ON performance_audits FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid())));

-- Fix UPDATE policy
DROP POLICY IF EXISTS "Users can update their organization's performance audits" ON performance_audits;
CREATE POLICY "Users can update their organization's performance audits"
  ON performance_audits FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid())));

-- ============================================================================
-- SEO_PROJECTS TABLE
-- ============================================================================

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users can view their org projects" ON seo_projects;
CREATE POLICY "Users can view their org projects"
  ON seo_projects FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid())));

-- Fix ALL policy
DROP POLICY IF EXISTS "Users can manage their org projects" ON seo_projects;
CREATE POLICY "Users can manage their org projects"
  ON seo_projects FOR ALL
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid())));

-- ============================================================================
-- DISMISSED_CHECKS TABLE
-- ============================================================================

-- Fix SELECT policy
DROP POLICY IF EXISTS "Users can view dismissed checks for their organization" ON dismissed_checks;
CREATE POLICY "Users can view dismissed checks for their organization"
  ON dismissed_checks FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- Fix INSERT policy
DROP POLICY IF EXISTS "Users can create dismissed checks for their organization" ON dismissed_checks;
CREATE POLICY "Users can create dismissed checks for their organization"
  ON dismissed_checks FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- Fix DELETE policy
DROP POLICY IF EXISTS "Users can delete dismissed checks for their organization" ON dismissed_checks;
CREATE POLICY "Users can delete dismissed checks for their organization"
  ON dismissed_checks FOR DELETE
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );
