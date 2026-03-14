-- Migration: App Settings Tables
-- Creates internal_employees, app_settings, and usage_logs tables
-- Modifies invites table for internal invite support

-- ============================================================================
-- 1. internal_employees table
-- ============================================================================
CREATE TABLE internal_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_internal_employees_public_user
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);

ALTER TABLE internal_employees ENABLE ROW LEVEL SECURITY;

-- SELECT: any internal user can view internal employees
CREATE POLICY "internal_employees_select"
  ON internal_employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
        AND is_internal = true
    )
  );

-- INSERT: internal admins only
CREATE POLICY "internal_employees_insert"
  ON internal_employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

-- UPDATE: internal admins only
CREATE POLICY "internal_employees_update"
  ON internal_employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

-- DELETE: internal admins only
CREATE POLICY "internal_employees_delete"
  ON internal_employees FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON internal_employees TO authenticated;

-- ============================================================================
-- 2. app_settings table
-- ============================================================================
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  credentials JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: internal users only
CREATE POLICY "app_settings_select"
  ON app_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
        AND is_internal = true
    )
  );

-- INSERT: internal admins only
CREATE POLICY "app_settings_insert"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

-- UPDATE: internal admins only
CREATE POLICY "app_settings_update"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

-- DELETE: internal admins only
CREATE POLICY "app_settings_delete"
  ON app_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN team_members tm ON tm.user_id = u.id
      WHERE u.id = (SELECT auth.uid())
        AND u.is_internal = true
        AND tm.role = 'admin'
    )
  );

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO authenticated;

-- SECURITY DEFINER function for service-level reads (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_app_credential(setting_key TEXT)
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT credentials FROM public.app_settings
  WHERE key = setting_key
  LIMIT 1;
$$;

-- ============================================================================
-- 3. usage_logs table
-- ============================================================================
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost NUMERIC(10,6),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: internal users only
CREATE POLICY "usage_logs_select"
  ON usage_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
        AND is_internal = true
    )
  );

-- No INSERT/UPDATE/DELETE policies — service client writes bypass RLS

-- Indexes
CREATE INDEX idx_usage_logs_service_created
  ON usage_logs (service, created_at DESC);

CREATE INDEX idx_usage_logs_org_created
  ON usage_logs (organization_id, created_at DESC);

-- GRANTs
GRANT SELECT ON usage_logs TO authenticated;

-- ============================================================================
-- 4. invites table changes
-- ============================================================================

-- Add type column for distinguishing org invites from internal invites
ALTER TABLE invites ADD COLUMN type TEXT NOT NULL DEFAULT 'org_invite';

-- Make organization_id nullable (internal invites have no org)
ALTER TABLE invites ALTER COLUMN organization_id DROP NOT NULL;

-- ============================================================================
-- 5. Backfill internal_employees from existing users
-- ============================================================================
INSERT INTO internal_employees (user_id)
SELECT id FROM users WHERE is_internal = true
ON CONFLICT (user_id) DO NOTHING;
