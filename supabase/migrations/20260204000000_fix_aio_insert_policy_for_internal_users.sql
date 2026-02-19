-- Fix AIO audit INSERT policy to allow internal users to create audits for any organization
-- Previously missing is_internal_user() check, so internal users could only create audits
-- for their own organization (which may be NULL).

DROP POLICY IF EXISTS "Users can insert AIO audits" ON aio_audits;

CREATE POLICY "Users can insert AIO audits"
ON aio_audits FOR INSERT
WITH CHECK (
  -- Internal users can create audits for any organization
  public.is_internal_user()
  OR
  -- Regular users can create for their own organization
  (organization_id = get_user_organization_id())
  OR
  -- Any authenticated user can create one-time audits (no org)
  ((organization_id IS NULL) AND (created_by = auth.uid()))
);

COMMENT ON POLICY "Users can insert AIO audits" ON aio_audits IS 'Allow internal users to create audits for any org, regular users for their org, and one-time audits for authenticated users';
