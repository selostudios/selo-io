-- Migration: Extract is_internal_admin() helper for RLS policies
-- Replaces repeated users JOIN team_members pattern with a single
-- SECURITY DEFINER function, evaluated once per statement.

-- ============================================================================
-- 1. Create helper function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_internal_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.team_members tm ON tm.user_id = u.id
    WHERE u.id = (SELECT auth.uid())
      AND u.is_internal = true
      AND tm.role = 'admin'
  );
$$;

-- ============================================================================
-- 2. Replace internal_employees policies
-- ============================================================================

-- INSERT
DROP POLICY "internal_employees_insert" ON internal_employees;
CREATE POLICY "internal_employees_insert"
  ON internal_employees FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_internal_admin()));

-- UPDATE
DROP POLICY "internal_employees_update" ON internal_employees;
CREATE POLICY "internal_employees_update"
  ON internal_employees FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_internal_admin()));

-- DELETE
DROP POLICY "internal_employees_delete" ON internal_employees;
CREATE POLICY "internal_employees_delete"
  ON internal_employees FOR DELETE
  TO authenticated
  USING ((SELECT public.is_internal_admin()));

-- ============================================================================
-- 3. Replace app_settings policies
-- ============================================================================

-- INSERT
DROP POLICY "app_settings_insert" ON app_settings;
CREATE POLICY "app_settings_insert"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_internal_admin()));

-- UPDATE
DROP POLICY "app_settings_update" ON app_settings;
CREATE POLICY "app_settings_update"
  ON app_settings FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_internal_admin()));

-- DELETE
DROP POLICY "app_settings_delete" ON app_settings;
CREATE POLICY "app_settings_delete"
  ON app_settings FOR DELETE
  TO authenticated
  USING ((SELECT public.is_internal_admin()));
