-- Fix remaining bare auth.uid() calls in storage bucket policies
-- and add missing foreign key index on invites.invited_by.
--
-- Storage policies were missed by the 20260410 optimization migration.
-- Bare auth.uid() is evaluated per-row; (SELECT auth.uid()) caches per-statement.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

BEGIN;

-- =============================================================================
-- 1. Fix organization-logos storage policies (bare auth.uid())
-- =============================================================================

DROP POLICY IF EXISTS "Org admins can upload logos" ON storage.objects;
CREATE POLICY "Org admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
    OR (SELECT public.is_internal_user())
  )
);

DROP POLICY IF EXISTS "Org admins can update logos" ON storage.objects;
CREATE POLICY "Org admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
    OR (SELECT public.is_internal_user())
  )
);

DROP POLICY IF EXISTS "Org admins can delete logos" ON storage.objects;
CREATE POLICY "Org admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
    OR (SELECT public.is_internal_user())
  )
);

-- =============================================================================
-- 2. Fix feedback-screenshots storage policies (bare auth.uid())
-- =============================================================================

DROP POLICY IF EXISTS "Users can upload feedback screenshots" ON storage.objects;
CREATE POLICY "Users can upload feedback screenshots"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'feedback-screenshots'
  AND (SELECT auth.uid()) IS NOT NULL
  AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can read own screenshots" ON storage.objects;
CREATE POLICY "Users can read own screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'feedback-screenshots'
  AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Developers can read all screenshots" ON storage.objects;
CREATE POLICY "Developers can read all screenshots"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'feedback-screenshots'
  AND (SELECT public.is_internal_user())
);

-- =============================================================================
-- 3. Add missing foreign key index on invites.invited_by
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_invites_invited_by ON invites (invited_by);

COMMIT;
