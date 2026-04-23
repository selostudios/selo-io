-- Drop users.organization_id and users.role in favour of team_members as the
-- sole source of truth for org membership + role.
--
-- This migration:
--   1. Rewrites 36 RLS policies that still reference users.organization_id or
--      users.role to instead use team_members via helper functions
--      (get_user_organization_ids, get_user_organization_id, is_internal_user).
--   2. Drops several legacy duplicate policies that were superseded but never
--      removed (on site_audits, site_audit_checks, site_audit_pages).
--   3. Drops the legacy columns from the users table.
--
-- Cross-org audit visibility: the previous policies granted admins and
-- developers read access across organisations. In the team_members model,
-- role is per-org, so cross-org escalation now relies solely on
-- is_internal_user() (Selo employees). Admins/developers of a given org
-- retain full access via normal org membership.

BEGIN;

-- =============================================================================
-- Pattern A: simple org-scoped policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can view campaigns in their organization" ON public.campaigns;
CREATE POLICY "Users can view campaigns in their organization" ON public.campaigns
  FOR SELECT TO public
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can create dismissed checks for their organization" ON public.dismissed_checks;
CREATE POLICY "Users can create dismissed checks for their organization" ON public.dismissed_checks
  FOR INSERT TO public
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can delete dismissed checks for their organization" ON public.dismissed_checks;
CREATE POLICY "Users can delete dismissed checks for their organization" ON public.dismissed_checks
  FOR DELETE TO public
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can view dismissed checks for their organization" ON public.dismissed_checks;
CREATE POLICY "Users can view dismissed checks for their organization" ON public.dismissed_checks
  FOR SELECT TO public
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can access their organization's monitored pages" ON public.monitored_pages;
CREATE POLICY "Users can access their organization's monitored pages" ON public.monitored_pages
  FOR ALL TO public
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can access their organization's monitored sites" ON public.monitored_sites;
CREATE POLICY "Users can access their organization's monitored sites" ON public.monitored_sites
  FOR ALL TO public
  USING (organization_id IN (SELECT public.get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can view platform connections in their organization" ON public.platform_connections;
CREATE POLICY "Users can view platform connections in their organization" ON public.platform_connections
  FOR SELECT TO public
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

DROP POLICY IF EXISTS "Users can view summaries in their organization" ON public.weekly_summaries;
CREATE POLICY "Users can view summaries in their organization" ON public.weekly_summaries
  FOR SELECT TO public
  USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- =============================================================================
-- Pattern B: unified audit child tables (audit_ai_analyses, audit_checks,
--            audit_crawl_queue, audit_pages) — sub-join through audits
-- =============================================================================

DROP POLICY IF EXISTS "Users can delete audit AI analyses" ON public.audit_ai_analyses;
CREATE POLICY "Users can delete audit AI analyses" ON public.audit_ai_analyses
  FOR DELETE TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can insert audit AI analyses" ON public.audit_ai_analyses;
CREATE POLICY "Users can insert audit AI analyses" ON public.audit_ai_analyses
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can view audit AI analyses" ON public.audit_ai_analyses;
CREATE POLICY "Users can view audit AI analyses" ON public.audit_ai_analyses
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can delete audit checks" ON public.audit_checks;
CREATE POLICY "Users can delete audit checks" ON public.audit_checks
  FOR DELETE TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can insert audit checks" ON public.audit_checks;
CREATE POLICY "Users can insert audit checks" ON public.audit_checks
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can view audit checks" ON public.audit_checks;
CREATE POLICY "Users can view audit checks" ON public.audit_checks
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can delete audit crawl queue" ON public.audit_crawl_queue;
CREATE POLICY "Users can delete audit crawl queue" ON public.audit_crawl_queue
  FOR DELETE TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can insert audit crawl queue" ON public.audit_crawl_queue;
CREATE POLICY "Users can insert audit crawl queue" ON public.audit_crawl_queue
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can view audit crawl queue" ON public.audit_crawl_queue;
CREATE POLICY "Users can view audit crawl queue" ON public.audit_crawl_queue
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can delete audit pages" ON public.audit_pages;
CREATE POLICY "Users can delete audit pages" ON public.audit_pages
  FOR DELETE TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can insert audit pages" ON public.audit_pages;
CREATE POLICY "Users can insert audit pages" ON public.audit_pages
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can view audit pages" ON public.audit_pages;
CREATE POLICY "Users can view audit pages" ON public.audit_pages
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT a.id FROM public.audits a
      WHERE a.organization_id IN (SELECT public.get_user_organization_ids())
        OR (a.organization_id IS NULL AND a.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

-- =============================================================================
-- Pattern C: audits table self-policies (DELETE + INSERT previously keyed on role)
-- =============================================================================

DROP POLICY IF EXISTS "Users can delete audits" ON public.audits;
CREATE POLICY "Users can delete audits" ON public.audits
  FOR DELETE TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = (SELECT auth.uid())
        AND tm.organization_id = audits.organization_id
        AND tm.role = 'admin'::public.user_role
    )
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR public.is_internal_user()
  );

DROP POLICY IF EXISTS "Users can insert audits" ON public.audits;
CREATE POLICY "Users can insert audits" ON public.audits
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = (SELECT auth.uid())
        AND tm.organization_id = audits.organization_id
        AND tm.role = ANY(ARRAY['admin'::public.user_role, 'external_developer'::public.user_role])
    )
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR public.is_internal_user()
  );

DROP POLICY IF EXISTS "Users can view audits" ON public.audits;
CREATE POLICY "Users can view audits" ON public.audits
  FOR SELECT TO public
  USING (
    organization_id IN (SELECT public.get_user_organization_ids())
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR public.is_internal_user()
  );

-- =============================================================================
-- Pattern D: legacy SELECT policies still referencing users.role / users.is_internal
--             on performance_audits, site_audits, and their child tables.
--             Replace the EXISTS(users ...) escalation with is_internal_user().
-- =============================================================================

DROP POLICY IF EXISTS "Users can view performance audits" ON public.performance_audits;
CREATE POLICY "Users can view performance audits" ON public.performance_audits
  FOR SELECT TO public
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR public.is_internal_user()
  );

DROP POLICY IF EXISTS "Users can insert performance results for their audits" ON public.performance_audit_results;
CREATE POLICY "Users can insert performance results for their audits" ON public.performance_audit_results
  FOR INSERT TO public
  WITH CHECK (
    audit_id IN (
      SELECT pa.id FROM public.performance_audits pa
      WHERE pa.organization_id IN (SELECT public.get_user_organization_ids())
        OR (pa.organization_id IS NULL AND pa.created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can view site audits" ON public.site_audits;
CREATE POLICY "Users can view site audits" ON public.site_audits
  FOR SELECT TO public
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR public.is_internal_user()
  );

DROP POLICY IF EXISTS "Users can view site audit checks" ON public.site_audit_checks;
CREATE POLICY "Users can view site audit checks" ON public.site_audit_checks
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT sa.id FROM public.site_audits sa
      WHERE sa.organization_id = public.get_user_organization_id()
        OR (sa.organization_id IS NULL AND sa.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can view site audit pages" ON public.site_audit_pages;
CREATE POLICY "Users can view site audit pages" ON public.site_audit_pages
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT sa.id FROM public.site_audits sa
      WHERE sa.organization_id = public.get_user_organization_id()
        OR (sa.organization_id IS NULL AND sa.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Users can view crawl queue" ON public.site_audit_crawl_queue;
CREATE POLICY "Users can view crawl queue" ON public.site_audit_crawl_queue
  FOR SELECT TO public
  USING (
    audit_id IN (
      SELECT sa.id FROM public.site_audits sa
      WHERE sa.organization_id = public.get_user_organization_id()
        OR (sa.organization_id IS NULL AND sa.created_by = (SELECT auth.uid()))
        OR public.is_internal_user()
    )
  );

-- =============================================================================
-- Pattern E: drop legacy duplicate policies superseded by the canonical
--            "Users can {verb} site audits/checks/pages" policies from
--            20260410130000_optimize_rls_auth_uid_caching.sql. These were
--            never dropped when the replacements landed.
-- =============================================================================

DROP POLICY IF EXISTS "Users can view audits" ON public.site_audits;
DROP POLICY IF EXISTS "Users can insert audits" ON public.site_audits;
DROP POLICY IF EXISTS "Users can update audits" ON public.site_audits;

DROP POLICY IF EXISTS "Users can view checks from their audits" ON public.site_audit_checks;
DROP POLICY IF EXISTS "Users can insert checks to their audits" ON public.site_audit_checks;

DROP POLICY IF EXISTS "Users can view pages from their audits" ON public.site_audit_pages;
DROP POLICY IF EXISTS "Users can insert pages to their audits" ON public.site_audit_pages;

-- =============================================================================
-- Pattern F: policies on the users table itself and the storage.objects logo
--             policies that still reference users.organization_id / users.role.
-- =============================================================================

DROP POLICY IF EXISTS "Users can view users" ON public.users;
CREATE POLICY "Users can view users" ON public.users
  FOR SELECT TO public
  USING (
    id = (SELECT auth.uid())
    OR public.is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.team_members mine
      JOIN public.team_members theirs ON mine.organization_id = theirs.organization_id
      WHERE mine.user_id = (SELECT auth.uid())
        AND theirs.user_id = users.id
    )
  );

DROP POLICY IF EXISTS "Org admins can upload logos" ON storage.objects;
CREATE POLICY "Org admins can upload logos" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'organization-logos'
    AND (
      ((storage.foldername(name))[1])::uuid IN (
        SELECT tm.organization_id FROM public.team_members tm
        WHERE tm.user_id = (SELECT auth.uid())
          AND tm.role = 'admin'::public.user_role
      )
      OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Org admins can update logos" ON storage.objects;
CREATE POLICY "Org admins can update logos" ON storage.objects
  FOR UPDATE TO public
  USING (
    bucket_id = 'organization-logos'
    AND (
      ((storage.foldername(name))[1])::uuid IN (
        SELECT tm.organization_id FROM public.team_members tm
        WHERE tm.user_id = (SELECT auth.uid())
          AND tm.role = 'admin'::public.user_role
      )
      OR public.is_internal_user()
    )
  );

DROP POLICY IF EXISTS "Org admins can delete logos" ON storage.objects;
CREATE POLICY "Org admins can delete logos" ON storage.objects
  FOR DELETE TO public
  USING (
    bucket_id = 'organization-logos'
    AND (
      ((storage.foldername(name))[1])::uuid IN (
        SELECT tm.organization_id FROM public.team_members tm
        WHERE tm.user_id = (SELECT auth.uid())
          AND tm.role = 'admin'::public.user_role
      )
      OR public.is_internal_user()
    )
  );

-- =============================================================================
-- Drop legacy columns. All policies, helper functions, and application code
-- now read org/role from public.team_members.
-- =============================================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

COMMIT;
