-- Fix INSERT policy for generated_reports to allow internal users
-- Internal users should be able to create reports for any organization

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create reports" ON generated_reports;

-- Create new INSERT policy that includes internal users
CREATE POLICY "Users can create reports"
ON generated_reports FOR INSERT
WITH CHECK (
  -- Regular users: can create for their org or one-time (null org)
  (
    organization_id = public.get_user_organization_id()
    AND created_by = (SELECT auth.uid())
  )
  OR (
    organization_id IS NULL
    AND created_by = (SELECT auth.uid())
  )
  -- Internal users: can create reports for any organization
  OR (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND is_internal = true
    )
  )
);
