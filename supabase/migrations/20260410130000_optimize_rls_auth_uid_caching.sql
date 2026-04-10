-- Optimize RLS policies and functions by replacing bare auth.uid() calls
-- with (select auth.uid()) for per-statement caching.
--
-- Bare auth.uid() is evaluated per-row, causing repeated function calls.
-- Wrapping in (select auth.uid()) caches the result for the entire statement.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Also adds a missing index on shared_links.created_by.

BEGIN;

-- =============================================================================
-- 1. Fix functions with bare auth.uid()
-- =============================================================================

-- is_internal_user() — used in many policies, so fixing this has cascading benefits
CREATE OR REPLACE FUNCTION public.is_internal_user()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  );
$$;

-- update_oauth_tokens() — called during OAuth token refresh
CREATE OR REPLACE FUNCTION public.update_oauth_tokens(
  p_connection_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_user_org_id uuid;
  v_connection_org_id uuid;
BEGIN
  SELECT organization_id INTO v_user_org_id
  FROM public.team_members
  WHERE user_id = (SELECT auth.uid())
  LIMIT 1;

  SELECT organization_id INTO v_connection_org_id
  FROM public.platform_connections
  WHERE id = p_connection_id;

  IF v_user_org_id IS NULL OR v_user_org_id != v_connection_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update connection for different organization';
  END IF;

  UPDATE public.platform_connections
  SET
    credentials = jsonb_set(
      jsonb_set(
        jsonb_set(
          credentials,
          '{access_token}',
          to_jsonb(p_access_token)
        ),
        '{refresh_token}',
        to_jsonb(p_refresh_token)
      ),
      '{expires_at}',
      to_jsonb(p_expires_at)
    ),
    updated_at = now()
  WHERE id = p_connection_id;
END;
$$;

-- =============================================================================
-- 2. Fix RLS policies — campaign_metrics
-- =============================================================================

DROP POLICY IF EXISTS "Users can view metrics in their organizations" ON campaign_metrics;
CREATE POLICY "Users can view metrics in their organizations" ON campaign_metrics
  FOR SELECT TO public
  USING (
    organization_id IN (
      SELECT tm.organization_id FROM team_members tm
      WHERE tm.user_id = (SELECT auth.uid())
    )
    OR (SELECT is_internal_user())
  );

DROP POLICY IF EXISTS "Users can insert metrics for their organizations" ON campaign_metrics;
CREATE POLICY "Users can insert metrics for their organizations" ON campaign_metrics
  FOR INSERT TO public
  WITH CHECK (
    organization_id IN (
      SELECT tm.organization_id FROM team_members tm
      WHERE tm.user_id = (SELECT auth.uid())
    )
    OR (SELECT is_internal_user())
  );

DROP POLICY IF EXISTS "Users can update metrics for their organizations" ON campaign_metrics;
CREATE POLICY "Users can update metrics for their organizations" ON campaign_metrics
  FOR UPDATE TO public
  USING (
    organization_id IN (
      SELECT tm.organization_id FROM team_members tm
      WHERE tm.user_id = (SELECT auth.uid())
    )
    OR (SELECT is_internal_user())
  )
  WITH CHECK (
    organization_id IN (
      SELECT tm.organization_id FROM team_members tm
      WHERE tm.user_id = (SELECT auth.uid())
    )
    OR (SELECT is_internal_user())
  );

-- =============================================================================
-- 3. Fix RLS policies — feedback
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON feedback;
CREATE POLICY "Authenticated users can submit feedback" ON feedback
  FOR INSERT TO public
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND submitted_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT TO public
  USING (
    submitted_by = (SELECT auth.uid())
  );

-- =============================================================================
-- 4. Fix RLS policies — performance_audit_results
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert performance results" ON performance_audit_results;
CREATE POLICY "Users can insert performance results" ON performance_audit_results
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT performance_audits.id FROM performance_audits
      WHERE performance_audits.organization_id = get_user_organization_id()
        OR (performance_audits.organization_id IS NULL
            AND performance_audits.created_by = (SELECT auth.uid()))
    )
  );

-- =============================================================================
-- 5. Fix RLS policies — performance_audits
-- =============================================================================

DROP POLICY IF EXISTS "Users can delete performance audits" ON performance_audits;
CREATE POLICY "Users can delete performance audits" ON performance_audits
  FOR DELETE TO public
  USING (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert performance audits" ON performance_audits;
CREATE POLICY "Users can insert performance audits" ON performance_audits
  FOR INSERT TO public
  WITH CHECK (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update performance audits" ON performance_audits;
CREATE POLICY "Users can update performance audits" ON performance_audits
  FOR UPDATE TO public
  USING (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view performance audits" ON performance_audits;
CREATE POLICY "Users can view performance audits" ON performance_audits
  FOR SELECT TO public
  USING (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND (users.is_internal = true
             OR users.role = ANY(ARRAY['admin'::user_role, 'developer'::user_role]))
    )
  );

-- =============================================================================
-- 6. Fix RLS policies — site_audits
-- =============================================================================

DROP POLICY IF EXISTS "Users can delete site audits" ON site_audits;
CREATE POLICY "Users can delete site audits" ON site_audits
  FOR DELETE TO public
  USING (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert site audits" ON site_audits;
CREATE POLICY "Users can insert site audits" ON site_audits
  FOR INSERT TO public
  WITH CHECK (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update site audits" ON site_audits;
CREATE POLICY "Users can update site audits" ON site_audits
  FOR UPDATE TO public
  USING (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view site audits" ON site_audits;
CREATE POLICY "Users can view site audits" ON site_audits
  FOR SELECT TO public
  USING (
    organization_id = get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
        AND (users.is_internal = true
             OR users.role = ANY(ARRAY['admin'::user_role, 'developer'::user_role]))
    )
  );

-- =============================================================================
-- 7. Fix RLS policies — site_audit_checks
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert site audit checks" ON site_audit_checks;
CREATE POLICY "Users can insert site audit checks" ON site_audit_checks
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can update site audit checks" ON site_audit_checks;
CREATE POLICY "Users can update site audit checks" ON site_audit_checks
  FOR UPDATE TO public
  USING (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can view site audit checks" ON site_audit_checks;
CREATE POLICY "Users can view site audit checks" ON site_audit_checks
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = (SELECT auth.uid())
            AND (users.is_internal = true
                 OR users.role = ANY(ARRAY['admin'::user_role, 'developer'::user_role]))
        )
    )
  );

-- =============================================================================
-- 8. Fix RLS policies — site_audit_pages
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert site audit pages" ON site_audit_pages;
CREATE POLICY "Users can insert site audit pages" ON site_audit_pages
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can update site audit pages" ON site_audit_pages;
CREATE POLICY "Users can update site audit pages" ON site_audit_pages
  FOR UPDATE TO public
  USING (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can view site audit pages" ON site_audit_pages;
CREATE POLICY "Users can view site audit pages" ON site_audit_pages
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = (SELECT auth.uid())
            AND (users.is_internal = true
                 OR users.role = ANY(ARRAY['admin'::user_role, 'developer'::user_role]))
        )
    )
  );

-- =============================================================================
-- 9. Fix RLS policies — site_audit_crawl_queue
-- =============================================================================

DROP POLICY IF EXISTS "Users can insert crawl queue" ON site_audit_crawl_queue;
CREATE POLICY "Users can insert crawl queue" ON site_audit_crawl_queue
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can update crawl queue" ON site_audit_crawl_queue;
CREATE POLICY "Users can update crawl queue" ON site_audit_crawl_queue
  FOR UPDATE TO public
  USING (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can view crawl queue" ON site_audit_crawl_queue;
CREATE POLICY "Users can view crawl queue" ON site_audit_crawl_queue
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT site_audits.id FROM site_audits
      WHERE site_audits.organization_id = get_user_organization_id()
        OR (site_audits.organization_id IS NULL
            AND site_audits.created_by = (SELECT auth.uid()))
        OR EXISTS (
          SELECT 1 FROM users
          WHERE users.id = (SELECT auth.uid())
            AND (users.is_internal = true
                 OR users.role = ANY(ARRAY['admin'::user_role, 'developer'::user_role]))
        )
    )
  );

-- =============================================================================
-- 10. Fix RLS policies — users
-- =============================================================================

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO public
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- =============================================================================
-- 11. Add missing index on shared_links.created_by
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_shared_links_created_by ON shared_links (created_by);

COMMIT;
