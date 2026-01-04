-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to logos
CREATE POLICY "Public can view organization logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');

-- Allow org admins to upload logos for their organization
CREATE POLICY "Org admins can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow org admins to update logos for their organization
CREATE POLICY "Org admins can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Allow org admins to delete logos for their organization
CREATE POLICY "Org admins can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT organization_id FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
