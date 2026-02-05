-- Fix storage policies for organization-logos to allow internal users
-- Internal users should be able to upload/update/delete logos for any organization

-- Drop existing policies
DROP POLICY IF EXISTS "Org admins can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Org admins can delete logos" ON storage.objects;

-- Recreate INSERT policy with internal user support
CREATE POLICY "Org admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (
    -- Regular admins: can only upload to their own org folder
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
    -- Internal users: can upload to any org folder
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_internal = true
    )
  )
);

-- Recreate UPDATE policy with internal user support
CREATE POLICY "Org admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_internal = true
    )
  )
);

-- Recreate DELETE policy with internal user support
CREATE POLICY "Org admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos'
  AND (
    (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND is_internal = true
    )
  )
);
