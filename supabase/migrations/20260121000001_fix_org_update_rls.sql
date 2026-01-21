-- Migration: Allow developers to update organizations (their own org)
-- This fixes the bug where developers cannot save organization settings
-- despite having canManageOrg permission in the application layer.

-- Drop the existing admin-only policy
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;

-- Create new policy that allows both admins and developers
CREATE POLICY "Admins and developers can update their organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
  );
