-- Migration: Fix remaining RLS performance warnings
-- 1. Wrap auth.uid() calls in (SELECT ...) for remaining policies
-- 2. Consolidate duplicate permissive policies into single policies with OR conditions

-- ============================================================================
-- USERS TABLE - Fix initplan + consolidate duplicate SELECT policies
-- ============================================================================

-- Drop duplicate policies and recreate as single optimized policy
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;

CREATE POLICY "Users can view users"
  ON users FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR (organization_id IS NOT NULL AND organization_id = (SELECT public.get_user_organization_id()))
  );

-- Fix INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
CREATE POLICY "Users can insert their own profile"
  ON users FOR INSERT
  WITH CHECK (id = (SELECT auth.uid()));

-- ============================================================================
-- CAMPAIGNS TABLE - Fix initplan + consolidate duplicate SELECT policies
-- ============================================================================

-- Drop duplicate policies
DROP POLICY IF EXISTS "Admins and team members can manage campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can view campaigns in their organization" ON campaigns;

-- Single SELECT policy (all org users can view)
CREATE POLICY "Users can view campaigns in their organization"
  ON campaigns FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- Separate policy for INSERT/UPDATE/DELETE (admins and team members only)
CREATE POLICY "Admins and team members can manage campaigns"
  ON campaigns FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'team_member')
    )
  );

-- ============================================================================
-- PLATFORM_CONNECTIONS TABLE - Fix initplan + consolidate duplicate policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage platform connections" ON platform_connections;
DROP POLICY IF EXISTS "Users can view platform connections in their organization" ON platform_connections;

-- Single SELECT policy
CREATE POLICY "Users can view platform connections in their organization"
  ON platform_connections FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- Admin-only management policy
CREATE POLICY "Admins can manage platform connections"
  ON platform_connections FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- INVITES TABLE - Fix initplan + consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage invites in their organization" ON invites;
DROP POLICY IF EXISTS "Users can read invites sent to their email" ON invites;

-- Combined SELECT policy: admins see org invites, users see their own email invites
CREATE POLICY "Users can view invites"
  ON invites FOR SELECT
  USING (
    -- User can see invites sent to their email
    email = (SELECT auth.jwt() ->> 'email')
    OR
    -- Admins can see all invites in their organization
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- Admin management policy for INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage invites"
  ON invites FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- CAMPAIGN_METRICS TABLE - Consolidate duplicate SELECT policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view metrics for campaigns in their organization" ON campaign_metrics;
DROP POLICY IF EXISTS "Users can view org-level metrics" ON campaign_metrics;

CREATE POLICY "Users can view metrics in their organization"
  ON campaign_metrics FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- ============================================================================
-- SITE_AUDIT_PAGES TABLE - Fix initplan warnings
-- ============================================================================

DROP POLICY IF EXISTS "Users can view pages from their audits" ON site_audit_pages;
CREATE POLICY "Users can view pages from their audits"
  ON site_audit_pages FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can insert pages to their audits" ON site_audit_pages;
CREATE POLICY "Users can insert pages to their audits"
  ON site_audit_pages FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

-- ============================================================================
-- SITE_AUDIT_CHECKS TABLE - Fix initplan warnings
-- ============================================================================

DROP POLICY IF EXISTS "Users can view checks from their audits" ON site_audit_checks;
CREATE POLICY "Users can view checks from their audits"
  ON site_audit_checks FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can insert checks to their audits" ON site_audit_checks;
CREATE POLICY "Users can insert checks to their audits"
  ON site_audit_checks FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

-- ============================================================================
-- PERFORMANCE_AUDIT_RESULTS TABLE - Fix initplan warnings
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization's performance results" ON performance_audit_results;
CREATE POLICY "Users can view their organization's performance results"
  ON performance_audit_results FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM performance_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can insert performance results for their audits" ON performance_audit_results;
CREATE POLICY "Users can insert performance results for their audits"
  ON performance_audit_results FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM performance_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

-- ============================================================================
-- MONITORED_PAGES TABLE - Fix initplan + consolidate duplicate policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization's monitored pages" ON monitored_pages;
DROP POLICY IF EXISTS "Users can manage their organization's monitored pages" ON monitored_pages;

-- Single ALL policy (view + manage combined)
CREATE POLICY "Users can access their organization's monitored pages"
  ON monitored_pages FOR ALL
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- ============================================================================
-- MONITORED_SITES TABLE - Fix initplan + consolidate duplicate policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their organization's monitored sites" ON monitored_sites;
DROP POLICY IF EXISTS "Users can manage their organization's monitored sites" ON monitored_sites;

-- Single ALL policy (view + manage combined)
CREATE POLICY "Users can access their organization's monitored sites"
  ON monitored_sites FOR ALL
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );

-- ============================================================================
-- SEO_PROJECTS TABLE - Fix initplan + consolidate duplicate policies
-- ============================================================================

-- Drop all existing duplicate policies
DROP POLICY IF EXISTS "Users can view their org projects" ON seo_projects;
DROP POLICY IF EXISTS "Users can manage their org projects" ON seo_projects;
DROP POLICY IF EXISTS "Users can insert projects for their org" ON seo_projects;
DROP POLICY IF EXISTS "Users can update their org projects" ON seo_projects;
DROP POLICY IF EXISTS "Users can delete their org projects" ON seo_projects;

-- Single ALL policy covers SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Users can access their organization's projects"
  ON seo_projects FOR ALL
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
  );
