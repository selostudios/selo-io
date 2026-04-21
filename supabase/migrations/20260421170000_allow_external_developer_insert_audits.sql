-- Allow external_developer role to create audits for their own organization.
-- The CLAUDE.md RBAC matrix lists external_developer as "Create/View (own org)"
-- for Unified Audits, but the existing CHECK constraint only permitted `admin`.
-- This denied inserts for external partners (e.g. bdsherpas/ADKF) whose app-layer
-- authorization passed but whose Postgres INSERT was then blocked by RLS.
--
-- Policy surface unchanged apart from the role list: one-time audits and
-- internal users continue to follow the same branches.

DROP POLICY IF EXISTS "Users can insert audits" ON audits;

CREATE POLICY "Users can insert audits"
  ON audits FOR INSERT
  WITH CHECK (
    (
      organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
      AND EXISTS (
        SELECT 1 FROM users
        WHERE id = (SELECT auth.uid())
          AND role IN ('admin', 'external_developer')
      )
    )
    OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
  );
