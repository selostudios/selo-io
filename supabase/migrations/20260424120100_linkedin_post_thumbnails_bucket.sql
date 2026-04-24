-- Private bucket for LinkedIn post thumbnails.
-- Path pattern: {organization_id}/{linkedin_urn}.jpg
INSERT INTO storage.buckets (id, name, public)
VALUES ('linkedin-post-thumbnails', 'linkedin-post-thumbnails', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated reads: only members of the owning org (or internal Selo users) may read.
-- The first path segment is the organization_id.
CREATE POLICY "linkedin_post_thumbnails_select_team_members"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'linkedin-post-thumbnails'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT organization_id FROM team_members WHERE user_id = (SELECT auth.uid())
      )
      OR (SELECT public.is_internal_user())
    )
  );

-- No INSERT/UPDATE/DELETE policies: writes happen via service client.
