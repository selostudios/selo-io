-- Fix team_members issues from initial migration:
-- 1. Add FK to public.users for PostgREST join inference
-- 2. Fix infinite recursion in SELECT RLS policy
-- 3. Add GRANT statements for table access
-- 4. Add ORDER BY to get_user_organization_id()

-- 1. Add FK to public.users (PostgREST needs this to infer the join)
-- The original FK to auth.users handles CASCADE delete; this one enables API joins.
-- Use DO block for idempotency (constraint may already exist from updated initial migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_team_members_public_user'
  ) THEN
    ALTER TABLE team_members
      ADD CONSTRAINT fk_team_members_public_user
      FOREIGN KEY (user_id) REFERENCES public.users(id);
  END IF;
END $$;

-- 2. Grant table permissions (missing from initial migration)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

-- 3. Helper function to get user's org IDs without hitting RLS (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT organization_id FROM public.team_members
  WHERE user_id = (select auth.uid());
$$;

-- 4. Replace the recursive SELECT policy
DROP POLICY IF EXISTS "Users can view team members" ON team_members;
CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR public.is_internal_user()
    OR organization_id IN (SELECT public.get_user_organization_ids())
  );

-- 5. Fix get_user_organization_id() — add ORDER BY for deterministic result
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT organization_id FROM public.team_members
  WHERE user_id = (select auth.uid())
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- 6. Revert is_developer() — should read from users.role, not team_members
-- Developer is an internal Selo role, not a per-org membership role.
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (select auth.uid())
    AND role = 'developer'
  );
$$;
