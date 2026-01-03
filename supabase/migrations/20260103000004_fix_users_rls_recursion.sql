-- Create a security definer function to get current user's organization_id
-- This bypasses RLS and prevents infinite recursion
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;

-- Recreate it using the helper function instead of a subquery
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND organization_id = auth.user_organization_id()
  );
