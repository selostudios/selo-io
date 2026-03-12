-- Create team_members join table to replace users.organization_id + users.role
-- Phase 1: Gradual migration - old columns kept for backward compatibility

-- 1. Create the table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'client_viewer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_org ON team_members(organization_id);

-- 2. Backfill from existing users
INSERT INTO team_members (user_id, organization_id, role)
SELECT id, organization_id, role FROM users
WHERE organization_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Users can view their own memberships + same-org members + internal sees all
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_internal_user()
    OR organization_id = public.get_user_organization_id()
  );

-- Users can insert their own membership (for invite acceptance)
CREATE POLICY "Users can insert own membership"
  ON team_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own membership
CREATE POLICY "Users can update own membership"
  ON team_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own membership (for leaving org)
CREATE POLICY "Users can delete own membership"
  ON team_members FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass for cron jobs and admin operations
CREATE POLICY "Service role full access to team_members"
  ON team_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Update get_user_organization_id() to read from team_members
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT organization_id FROM public.team_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- 5. Update is_developer() to read role from team_members
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
    AND role = 'developer'
  );
$$;

-- 6. Update user_in_aio_audit_org() to read from team_members
CREATE OR REPLACE FUNCTION public.user_in_aio_audit_org(audit_org_id uuid, audit_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    audit_created_by = auth.uid()
    OR public.is_internal_user()
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = auth.uid()
      AND organization_id = audit_org_id
    );
$$;

-- 7. Update get_organization_user_emails() to join team_members
DROP FUNCTION IF EXISTS public.get_organization_user_emails(UUID);
CREATE OR REPLACE FUNCTION public.get_organization_user_emails(org_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    u.id as user_id,
    au.email as email,
    COALESCE(u.first_name, au.raw_user_meta_data->>'first_name', SPLIT_PART(au.email, '@', 1)) as first_name,
    COALESCE(u.last_name, au.raw_user_meta_data->>'last_name', '') as last_name
  FROM public.team_members tm
  JOIN public.users u ON u.id = tm.user_id
  JOIN auth.users au ON au.id = tm.user_id
  WHERE tm.organization_id = org_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_organization_user_emails(UUID) TO authenticated;
