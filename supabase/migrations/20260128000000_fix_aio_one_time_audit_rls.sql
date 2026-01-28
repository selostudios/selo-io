-- Fix AIO audit RLS to allow one-time audits for any authenticated user
-- Previously only internal users could create audits with organization_id = NULL

DROP POLICY IF EXISTS "Users can insert AIO audits for their org" ON aio_audits;
CREATE POLICY "Users can insert AIO audits"
ON aio_audits FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND (
      -- Organization audits: user must belong to that org
      users.organization_id = aio_audits.organization_id
      OR
      -- One-time audits: user sets themselves as creator
      (aio_audits.organization_id IS NULL AND aio_audits.created_by = auth.uid())
    )
  )
);

COMMENT ON POLICY "Users can insert AIO audits" ON aio_audits IS 'Allow users to create audits for their org or one-time audits (no org) when they are the creator';
