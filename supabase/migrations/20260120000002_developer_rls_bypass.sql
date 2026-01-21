-- Migration: Add developer bypass to existing RLS policies
-- This allows users with the 'developer' role to view all organization-scoped data
-- for purposes of cross-org support, debugging, and feedback management.

-- Helper function to check if current user is a developer
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'developer'
  );
$$;

-- Update organizations RLS to allow developer access
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  USING (
    id IN (SELECT organization_id FROM users WHERE users.id = auth.uid())
    OR public.is_developer()
  );

-- Update campaigns RLS to allow developer access
DROP POLICY IF EXISTS "Users can view campaigns in their organization" ON campaigns;
CREATE POLICY "Users can view campaigns in their organization"
  ON campaigns FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid())
    OR public.is_developer()
  );

-- Update users table RLS to allow developer access
-- Note: This policy was updated in 20260103000004 to use get_user_organization_id()
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
CREATE POLICY "Users can view users in their organization"
  ON users FOR SELECT
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_user_organization_id())
    OR id = auth.uid()
    OR public.is_developer()
  );

-- Update platform_connections RLS to allow developer access
DROP POLICY IF EXISTS "Users can view platform connections in their organization" ON platform_connections;
CREATE POLICY "Users can view platform connections in their organization"
  ON platform_connections FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE users.id = auth.uid())
    OR public.is_developer()
  );
