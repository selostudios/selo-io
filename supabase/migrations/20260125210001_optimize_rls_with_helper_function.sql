-- Create helper function to get user's organization ID
-- This function is STABLE (result doesn't change during transaction)
-- Using this function in RLS policies avoids redundant subquery evaluation

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_organization_id() TO authenticated;

-- Recreate RLS policies using the helper function for better performance
-- This eliminates nested subqueries that were evaluated per-row

-- ============================================================
-- SITE AUDITS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view site audits" ON site_audits;
CREATE POLICY "Users can view site audits" ON site_audits
  FOR SELECT
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (is_internal = true OR role IN ('admin', 'developer'))
    )
  );

DROP POLICY IF EXISTS "Users can insert site audits" ON site_audits;
CREATE POLICY "Users can insert site audits" ON site_audits
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update site audits" ON site_audits;
CREATE POLICY "Users can update site audits" ON site_audits
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete site audits" ON site_audits;
CREATE POLICY "Users can delete site audits" ON site_audits
  FOR DELETE
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
  );

-- ============================================================
-- SITE AUDIT PAGES POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view site audit pages" ON site_audit_pages;
CREATE POLICY "Users can view site audit pages" ON site_audit_pages
  FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
         OR EXISTS (
           SELECT 1 FROM users
           WHERE id = auth.uid()
           AND (is_internal = true OR role IN ('admin', 'developer'))
         )
    )
  );

DROP POLICY IF EXISTS "Users can insert site audit pages" ON site_audit_pages;
CREATE POLICY "Users can insert site audit pages" ON site_audit_pages
  FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update site audit pages" ON site_audit_pages;
CREATE POLICY "Users can update site audit pages" ON site_audit_pages
  FOR UPDATE
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
    )
  );

-- ============================================================
-- SITE AUDIT CHECKS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view site audit checks" ON site_audit_checks;
CREATE POLICY "Users can view site audit checks" ON site_audit_checks
  FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
         OR EXISTS (
           SELECT 1 FROM users
           WHERE id = auth.uid()
           AND (is_internal = true OR role IN ('admin', 'developer'))
         )
    )
  );

DROP POLICY IF EXISTS "Users can insert site audit checks" ON site_audit_checks;
CREATE POLICY "Users can insert site audit checks" ON site_audit_checks
  FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update site audit checks" ON site_audit_checks;
CREATE POLICY "Users can update site audit checks" ON site_audit_checks
  FOR UPDATE
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
    )
  );

-- ============================================================
-- PERFORMANCE AUDITS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view performance audits" ON performance_audits;
CREATE POLICY "Users can view performance audits" ON performance_audits
  FOR SELECT
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (is_internal = true OR role IN ('admin', 'developer'))
    )
  );

DROP POLICY IF EXISTS "Users can insert performance audits" ON performance_audits;
CREATE POLICY "Users can insert performance audits" ON performance_audits
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update performance audits" ON performance_audits;
CREATE POLICY "Users can update performance audits" ON performance_audits
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete performance audits" ON performance_audits;
CREATE POLICY "Users can delete performance audits" ON performance_audits
  FOR DELETE
  USING (
    organization_id = public.get_user_organization_id()
    OR (organization_id IS NULL AND created_by = auth.uid())
  );

-- ============================================================
-- PERFORMANCE AUDIT RESULTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view their organization's and own performance results" ON performance_audit_results;
CREATE POLICY "Users can view performance results" ON performance_audit_results
  FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM performance_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
         OR EXISTS (
           SELECT 1 FROM users
           WHERE id = auth.uid()
           AND (is_internal = true OR role IN ('admin', 'developer'))
         )
    )
  );

DROP POLICY IF EXISTS "Users can insert performance results" ON performance_audit_results;
CREATE POLICY "Users can insert performance results" ON performance_audit_results
  FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM performance_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
    )
  );

-- ============================================================
-- CRAWL QUEUE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view crawl queue for their audits" ON site_audit_crawl_queue;
CREATE POLICY "Users can view crawl queue" ON site_audit_crawl_queue
  FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
         OR EXISTS (
           SELECT 1 FROM users
           WHERE id = auth.uid()
           AND (is_internal = true OR role IN ('admin', 'developer'))
         )
    )
  );

DROP POLICY IF EXISTS "Users can insert crawl queue for their audits" ON site_audit_crawl_queue;
CREATE POLICY "Users can insert crawl queue" ON site_audit_crawl_queue
  FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update crawl queue for their audits" ON site_audit_crawl_queue;
CREATE POLICY "Users can update crawl queue" ON site_audit_crawl_queue
  FOR UPDATE
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id = public.get_user_organization_id()
         OR (organization_id IS NULL AND created_by = auth.uid())
    )
  );
