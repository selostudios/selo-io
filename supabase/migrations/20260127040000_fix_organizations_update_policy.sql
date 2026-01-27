-- Fix organizations UPDATE policy to allow internal users to update any organization
--
-- Issue: The previous policy was missing an explicit WITH CHECK clause, which caused
-- it to default to the same as USING. This prevented internal users from updating
-- organizations they're not members of because the WITH CHECK would fail.
--
-- Solution: Add explicit WITH CHECK that allows internal users to update any org.

DROP POLICY IF EXISTS "Update organizations" ON organizations;

CREATE POLICY "Update organizations"
  ON organizations FOR UPDATE
  USING (
    -- Who can select rows to update
    public.is_internal_user()
    OR (
      id = (SELECT public.get_user_organization_id())
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
  )
  WITH CHECK (
    -- What the updated row must satisfy
    public.is_internal_user()
    OR (
      id = (SELECT public.get_user_organization_id())
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    )
  );
