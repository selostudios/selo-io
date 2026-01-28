-- Fix AIO audit RLS to allow one-time audits for any authenticated user
-- Previously only internal users could create audits with organization_id = NULL
-- Updated to match the working site_audits pattern using get_user_organization_id()

DROP POLICY IF EXISTS "Users can insert AIO audits for their org" ON aio_audits;
DROP POLICY IF EXISTS "Users can insert AIO audits" ON aio_audits;

CREATE POLICY "Users can insert AIO audits"
ON aio_audits FOR INSERT
WITH CHECK (
  (organization_id = get_user_organization_id())
  OR
  ((organization_id IS NULL) AND (created_by = auth.uid()))
);

COMMENT ON POLICY "Users can insert AIO audits" ON aio_audits IS 'Allow users to create audits for their org or one-time audits (no org) when they are the creator';
