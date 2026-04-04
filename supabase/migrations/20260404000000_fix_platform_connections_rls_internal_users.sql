-- Fix platform_connections RLS policies to allow internal users (Selo employees)
-- to manage connections for any organization, not just their own.
-- Previously only the SELECT policy had an internal user bypass.

-- INSERT: allow internal users
DROP POLICY "Admins can insert platform connections" ON public.platform_connections;
CREATE POLICY "Admins can insert platform connections" ON public.platform_connections
  FOR INSERT
  WITH CHECK (
    ((SELECT get_user_organization_id()) = organization_id AND (SELECT get_user_role()) = 'admin')
    OR (SELECT public.is_internal_user())
  );

-- UPDATE: allow internal users
DROP POLICY "Admins can update platform connections" ON public.platform_connections;
CREATE POLICY "Admins can update platform connections" ON public.platform_connections
  FOR UPDATE
  USING (
    ((SELECT get_user_organization_id()) = organization_id AND (SELECT get_user_role()) = 'admin')
    OR (SELECT public.is_internal_user())
  );

-- DELETE: allow internal users
DROP POLICY "Admins can delete platform connections" ON public.platform_connections;
CREATE POLICY "Admins can delete platform connections" ON public.platform_connections
  FOR DELETE
  USING (
    ((SELECT get_user_organization_id()) = organization_id AND (SELECT get_user_role()) = 'admin')
    OR (SELECT public.is_internal_user())
  );
