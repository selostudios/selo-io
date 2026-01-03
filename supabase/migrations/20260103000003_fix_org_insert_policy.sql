-- Drop the old policy that creates chicken-and-egg problem
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;

-- Allow authenticated users to insert an organization if they don't have one yet
-- OR if they're already an admin (for future multi-org support)
CREATE POLICY "Users can create their first organization"
  ON organizations FOR INSERT
  WITH CHECK (
    -- User is authenticated
    auth.uid() IS NOT NULL
    AND (
      -- User doesn't have an organization yet
      NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND organization_id IS NOT NULL
      )
      OR
      -- OR user is already an admin (for future multi-org scenarios)
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );
