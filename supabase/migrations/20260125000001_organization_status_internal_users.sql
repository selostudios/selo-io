-- Migration: Add organization status and internal user support
-- This enables:
-- 1. Internal users (Selo employees) who can view all organizations
-- 2. Organization status tracking (prospect -> customer -> inactive)
-- 3. Removal of seo_projects in favor of direct organization selection

-- ============================================================================
-- PART 1: CREATE ENUM TYPE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_status') THEN
    CREATE TYPE organization_status AS ENUM ('prospect', 'customer', 'inactive');
  END IF;
END
$$;

-- ============================================================================
-- PART 2: UPDATE USERS TABLE
-- ============================================================================

-- Add is_internal flag for Selo employees
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- Make organization_id nullable (internal users may not belong to a client org)
ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

-- Create index for is_internal queries
CREATE INDEX IF NOT EXISTS idx_users_is_internal ON users(is_internal) WHERE is_internal = true;

-- ============================================================================
-- PART 3: UPDATE ORGANIZATIONS TABLE
-- ============================================================================

-- Add status column
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status organization_status DEFAULT 'prospect';

-- Add contact_email for primary contact
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Set existing organizations to 'customer' status (they're already onboarded)
-- Only update NULL values to ensure idempotency on re-runs
UPDATE organizations SET status = 'customer' WHERE status IS NULL;

-- Create index on status for filtering queries
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- ============================================================================
-- PART 4: DROP PROJECT_ID FROM AUDIT TABLES
-- ============================================================================

-- Remove project_id from site_audits
ALTER TABLE site_audits DROP COLUMN IF EXISTS project_id;

-- Remove project_id from performance_audits
ALTER TABLE performance_audits DROP COLUMN IF EXISTS project_id;

-- Drop the indexes if they exist
DROP INDEX IF EXISTS idx_site_audits_project;
DROP INDEX IF EXISTS idx_performance_audits_project;

-- ============================================================================
-- PART 5: DROP SEO_PROJECTS TABLE
-- ============================================================================

-- Drop the trigger first
DROP TRIGGER IF EXISTS seo_projects_updated_at ON seo_projects;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_seo_projects_updated_at();

-- Drop all RLS policies on seo_projects
DROP POLICY IF EXISTS "Users can view their org projects" ON seo_projects;
DROP POLICY IF EXISTS "Users can insert projects for their org" ON seo_projects;
DROP POLICY IF EXISTS "Users can update their org projects" ON seo_projects;
DROP POLICY IF EXISTS "Users can delete their org projects" ON seo_projects;
DROP POLICY IF EXISTS "Users can manage their org projects" ON seo_projects;
DROP POLICY IF EXISTS "Users can access their organization's projects" ON seo_projects;

-- Drop the table
DROP TABLE IF EXISTS seo_projects;

-- ============================================================================
-- PART 6: HELPER FUNCTION FOR INTERNAL USER CHECK
-- ============================================================================

-- Create or replace helper function to check if current user is internal
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_internal = true
  );
$$;

-- ============================================================================
-- PART 7: UPDATE ORGANIZATIONS RLS POLICIES
-- ============================================================================

-- Drop existing organization policies (various naming patterns)
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "Admins can insert organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create their first organization" ON organizations;

-- Create new organization policies with internal user support

-- View: internal users see all, external users see their own org
CREATE POLICY "View organizations"
  ON organizations FOR SELECT
  USING (
    public.is_internal_user()
    OR id = (SELECT public.get_user_organization_id())
  );

-- Create: only internal users can create organizations
CREATE POLICY "Create organizations"
  ON organizations FOR INSERT
  WITH CHECK (
    public.is_internal_user()
  );

-- Update: internal users can update any, external admins can update their own
CREATE POLICY "Update organizations"
  ON organizations FOR UPDATE
  USING (
    public.is_internal_user()
    OR (
      id = (SELECT public.get_user_organization_id())
      AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin')
    )
  );

-- ============================================================================
-- PART 8: UPDATE SITE_AUDITS RLS POLICIES
-- ============================================================================

-- Drop existing site_audits policies
DROP POLICY IF EXISTS "Users can view their organization's audits" ON site_audits;
DROP POLICY IF EXISTS "Users can insert audits for their organization" ON site_audits;
DROP POLICY IF EXISTS "Users can update their organization's audits" ON site_audits;
DROP POLICY IF EXISTS "Users can delete their organization's audits" ON site_audits;

-- View: internal users see all, external users see their org's audits
CREATE POLICY "View site audits"
  ON site_audits FOR SELECT
  USING (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- Create: internal users can create for any org, external users for their org
CREATE POLICY "Create site audits"
  ON site_audits FOR INSERT
  WITH CHECK (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- Update: internal users can update any, external users can update their org's
CREATE POLICY "Update site audits"
  ON site_audits FOR UPDATE
  USING (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  )
  WITH CHECK (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- Delete: internal users can delete any, external users can delete their org's
CREATE POLICY "Delete site audits"
  ON site_audits FOR DELETE
  USING (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- ============================================================================
-- PART 9: UPDATE PERFORMANCE_AUDITS RLS POLICIES
-- ============================================================================

-- Drop existing performance_audits policies
DROP POLICY IF EXISTS "Users can view their organization's performance audits" ON performance_audits;
DROP POLICY IF EXISTS "Users can insert performance audits for their organization" ON performance_audits;
DROP POLICY IF EXISTS "Users can update their organization's performance audits" ON performance_audits;
DROP POLICY IF EXISTS "Users can delete their organization's performance audits" ON performance_audits;

-- View: internal users see all, external users see their org's audits
CREATE POLICY "View performance audits"
  ON performance_audits FOR SELECT
  USING (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- Create: internal users can create for any org, external users for their org
CREATE POLICY "Create performance audits"
  ON performance_audits FOR INSERT
  WITH CHECK (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- Update: internal users can update any, external users can update their org's
CREATE POLICY "Update performance audits"
  ON performance_audits FOR UPDATE
  USING (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  )
  WITH CHECK (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- Delete: internal users can delete any, external users can delete their org's
CREATE POLICY "Delete performance audits"
  ON performance_audits FOR DELETE
  USING (
    public.is_internal_user()
    OR organization_id = (SELECT public.get_user_organization_id())
  );

-- ============================================================================
-- PART 10: UPDATE USERS RLS POLICY TO INCLUDE INTERNAL USER SUPPORT
-- ============================================================================

-- Drop and recreate users SELECT policy to support internal users viewing all
DROP POLICY IF EXISTS "Users can view users" ON users;
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;

CREATE POLICY "Users can view users"
  ON users FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR public.is_internal_user()
    OR (organization_id IS NOT NULL AND organization_id = (SELECT public.get_user_organization_id()))
  );
