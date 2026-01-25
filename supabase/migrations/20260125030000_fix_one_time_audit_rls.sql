-- Fix RLS policies for one-time audits (where organization_id IS NULL)
-- Add created_by column to track who created one-time audits

-- Add created_by column to site_audits
ALTER TABLE site_audits ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update existing RLS policies for site_audits to allow one-time audit access
DROP POLICY IF EXISTS "Users can view their organization's audits" ON site_audits;
DROP POLICY IF EXISTS "Users can view audits" ON site_audits;
CREATE POLICY "Users can view audits"
  ON site_audits FOR SELECT
  USING (
    -- Organization audits: user is member of the organization
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    OR
    -- One-time audits: user created the audit
    (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert audits for their organization" ON site_audits;
DROP POLICY IF EXISTS "Users can insert audits" ON site_audits;
CREATE POLICY "Users can insert audits"
  ON site_audits FOR INSERT
  WITH CHECK (
    -- Organization audits
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    OR
    -- One-time audits: user sets themselves as creator
    (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update their organization's audits" ON site_audits;
DROP POLICY IF EXISTS "Users can update audits" ON site_audits;
CREATE POLICY "Users can update audits"
  ON site_audits FOR UPDATE
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    OR
    (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  );

-- Update RLS policies for site_audit_pages
DROP POLICY IF EXISTS "Users can view pages from their audits" ON site_audit_pages;
CREATE POLICY "Users can view pages from their audits"
  ON site_audit_pages FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
         OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can insert pages to their audits" ON site_audit_pages;
CREATE POLICY "Users can insert pages to their audits"
  ON site_audit_pages FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
         OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    )
  );

-- Update RLS policies for site_audit_checks
DROP POLICY IF EXISTS "Users can view checks from their audits" ON site_audit_checks;
CREATE POLICY "Users can view checks from their audits"
  ON site_audit_checks FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
         OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can insert checks to their audits" ON site_audit_checks;
CREATE POLICY "Users can insert checks to their audits"
  ON site_audit_checks FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM site_audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
         OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    )
  );
