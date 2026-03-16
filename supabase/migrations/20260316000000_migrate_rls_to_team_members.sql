-- Migration: Rewrite 16 RLS policies to use team_members via helper functions
--
-- This migration eliminates all remaining references to users.organization_id
-- and users.role in RLS policies by using helper functions that read from
-- team_members (the source of truth for org membership and roles).
--
-- New helpers: get_user_role()
-- Updated helpers: is_developer() (now checks is_internal instead of role)
-- Affected tables: organizations, invites, campaigns, platform_connections,
--                  campaign_metrics, feedback, storage.objects,
--                  performance_audit_results

BEGIN;

-- ============================================================================
-- 1. CREATE get_user_role() HELPER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role::text FROM public.team_members
  WHERE user_id = (SELECT auth.uid())
  ORDER BY created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- ============================================================================
-- 2. UPDATE is_developer() TO USE is_internal INSTEAD OF users.role
-- ============================================================================
-- Previously checked users.role = 'developer'. Now checks users.is_internal,
-- which is the correct semantic: developer = internal Selo employee.

CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  );
$$;

-- ============================================================================
-- 3. ORGANIZATIONS TABLE (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Update organizations" ON organizations;
-- Also drop older names in case of partial migration
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Admins and developers can update their organization" ON organizations;

CREATE POLICY "Update organizations"
  ON organizations FOR UPDATE
  USING (
    (SELECT public.is_internal_user())
    OR (
      id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) = 'admin'
    )
  )
  WITH CHECK (
    (SELECT public.is_internal_user())
    OR (
      id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) = 'admin'
    )
  );

-- ============================================================================
-- 4. INVITES TABLE (4 policies)
-- ============================================================================

-- 4a. SELECT
DROP POLICY IF EXISTS "Users can view invites" ON invites;

CREATE POLICY "Users can view invites"
  ON invites FOR SELECT
  USING (
    LOWER(email) = LOWER((SELECT (SELECT auth.jwt()) ->> 'email'))
    OR (
      organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) = 'admin'
    )
    OR (SELECT public.is_internal_user())
  );

-- 4b. INSERT
DROP POLICY IF EXISTS "Admins can insert invites" ON invites;

CREATE POLICY "Admins can insert invites"
  ON invites FOR INSERT
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) = 'admin'
  );

-- 4c. UPDATE
DROP POLICY IF EXISTS "Users can update their own invites" ON invites;

CREATE POLICY "Users can update their own invites"
  ON invites FOR UPDATE
  USING (
    LOWER(email) = LOWER((SELECT (SELECT auth.jwt()) ->> 'email'))
    OR (
      organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) = 'admin'
    )
    OR (SELECT public.is_internal_user())
  );

-- 4d. DELETE
DROP POLICY IF EXISTS "Admins can delete invites" ON invites;

CREATE POLICY "Admins can delete invites"
  ON invites FOR DELETE
  USING (
    (
      organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) = 'admin'
    )
    OR (SELECT public.is_internal_user())
  );

-- ============================================================================
-- 5. CAMPAIGNS TABLE (3 policies)
-- ============================================================================

-- 5a. INSERT
DROP POLICY IF EXISTS "Admins and team members can insert campaigns" ON campaigns;

CREATE POLICY "Admins and team members can insert campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) IN ('admin', 'team_member')
  );

-- 5b. UPDATE
DROP POLICY IF EXISTS "Admins and team members can update campaigns" ON campaigns;

CREATE POLICY "Admins and team members can update campaigns"
  ON campaigns FOR UPDATE
  USING (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) IN ('admin', 'team_member')
  );

-- 5c. DELETE
DROP POLICY IF EXISTS "Admins and team members can delete campaigns" ON campaigns;

CREATE POLICY "Admins and team members can delete campaigns"
  ON campaigns FOR DELETE
  USING (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) IN ('admin', 'team_member')
  );

-- ============================================================================
-- 6. PLATFORM_CONNECTIONS TABLE (3 policies)
-- ============================================================================

-- 6a. INSERT
DROP POLICY IF EXISTS "Admins can insert platform connections" ON platform_connections;

CREATE POLICY "Admins can insert platform connections"
  ON platform_connections FOR INSERT
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) = 'admin'
  );

-- 6b. UPDATE
DROP POLICY IF EXISTS "Admins can update platform connections" ON platform_connections;

CREATE POLICY "Admins can update platform connections"
  ON platform_connections FOR UPDATE
  USING (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) = 'admin'
  );

-- 6c. DELETE
DROP POLICY IF EXISTS "Admins can delete platform connections" ON platform_connections;

CREATE POLICY "Admins can delete platform connections"
  ON platform_connections FOR DELETE
  USING (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) = 'admin'
  );

-- ============================================================================
-- 7. CAMPAIGN_METRICS TABLE (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view metrics in their organization" ON campaign_metrics;

CREATE POLICY "Users can view metrics in their organization"
  ON campaign_metrics FOR SELECT
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

-- ============================================================================
-- 8. FEEDBACK TABLE (2 policies)
-- ============================================================================

-- 8a. SELECT
DROP POLICY IF EXISTS "Admins and developers can view all feedback" ON feedback;

CREATE POLICY "Admins and developers can view all feedback"
  ON feedback FOR SELECT
  USING (
    (SELECT public.is_internal_user())
  );

-- 8b. UPDATE
DROP POLICY IF EXISTS "Admins and developers can update feedback" ON feedback;

CREATE POLICY "Admins and developers can update feedback"
  ON feedback FOR UPDATE
  USING (
    (SELECT public.is_internal_user())
  )
  WITH CHECK (
    (SELECT public.is_internal_user())
  );

-- ============================================================================
-- 9. STORAGE.OBJECTS TABLE (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Admins and developers can read all screenshots" ON storage.objects;

CREATE POLICY "Admins and developers can read all screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-screenshots'
    AND (SELECT public.is_internal_user())
  );

-- ============================================================================
-- 10. PERFORMANCE_AUDIT_RESULTS TABLE (1 policy)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view performance results" ON performance_audit_results;
-- Also drop older name in case of partial migration
DROP POLICY IF EXISTS "Users can view their organization's and own performance results" ON performance_audit_results;

CREATE POLICY "Users can view performance results"
  ON performance_audit_results FOR SELECT
  USING (
    audit_id IN (
      SELECT pa.id FROM public.performance_audits pa
      WHERE pa.organization_id = (SELECT public.get_user_organization_id())
         OR (pa.organization_id IS NULL AND pa.created_by = (SELECT auth.uid()))
    )
    OR (SELECT public.is_internal_user())
  );

-- ============================================================================
-- 11. ADD MISSING INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_ai_analyses_audit_id ON audit_ai_analyses(audit_id);

COMMIT;
