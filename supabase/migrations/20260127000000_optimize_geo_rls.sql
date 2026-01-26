-- Optimize GEO audit RLS policies
-- Addresses security-rls-subquery: Replace uncorrelated subqueries with security definer functions

-- Create helper function for user's organization check
CREATE OR REPLACE FUNCTION user_in_geo_audit_org(audit_org_id uuid, audit_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND (
      organization_id = audit_org_id
      OR audit_created_by = auth.uid()
      OR is_internal = true
    )
  );
$$;

-- Drop and recreate geo_audits policies with optimized logic
DROP POLICY IF EXISTS "Users can view their org's GEO audits" ON geo_audits;
CREATE POLICY "Users can view their org's GEO audits"
ON geo_audits FOR SELECT
USING (user_in_geo_audit_org(organization_id, created_by));

DROP POLICY IF EXISTS "Users can update their GEO audits" ON geo_audits;
CREATE POLICY "Users can update their GEO audits"
ON geo_audits FOR UPDATE
USING (user_in_geo_audit_org(organization_id, created_by));

DROP POLICY IF EXISTS "Users can delete their GEO audits" ON geo_audits;
CREATE POLICY "Users can delete their GEO audits"
ON geo_audits FOR DELETE
USING (user_in_geo_audit_org(organization_id, created_by));

-- Optimize INSERT policy separately (different logic)
DROP POLICY IF EXISTS "Users can insert GEO audits for their org" ON geo_audits;
CREATE POLICY "Users can insert GEO audits for their org"
ON geo_audits FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND (
      users.organization_id = geo_audits.organization_id
      OR (geo_audits.organization_id IS NULL AND users.is_internal = true)
    )
  )
);

-- Optimize geo_checks SELECT policy (join instead of subquery)
DROP POLICY IF EXISTS "Users can view checks from their audits" ON geo_checks;
CREATE POLICY "Users can view checks from their audits"
ON geo_checks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM geo_audits a
    INNER JOIN users u ON u.id = auth.uid()
    WHERE a.id = geo_checks.audit_id
    AND (
      u.organization_id = a.organization_id
      OR a.created_by = auth.uid()
      OR u.is_internal = true
    )
  )
);

-- Optimize geo_ai_analyses SELECT policy (join instead of subquery)
DROP POLICY IF EXISTS "Users can view AI analyses from their audits" ON geo_ai_analyses;
CREATE POLICY "Users can view AI analyses from their audits"
ON geo_ai_analyses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM geo_audits a
    INNER JOIN users u ON u.id = auth.uid()
    WHERE a.id = geo_ai_analyses.audit_id
    AND (
      u.organization_id = a.organization_id
      OR a.created_by = auth.uid()
      OR u.is_internal = true
    )
  )
);

-- Add GIN indexes for JSONB columns (if queries filter/search JSONB)
CREATE INDEX IF NOT EXISTS idx_geo_checks_details ON geo_checks USING gin(details);
CREATE INDEX IF NOT EXISTS idx_geo_ai_analyses_findings ON geo_ai_analyses USING gin(findings);
CREATE INDEX IF NOT EXISTS idx_geo_ai_analyses_recommendations ON geo_ai_analyses USING gin(recommendations);

COMMENT ON FUNCTION user_in_geo_audit_org IS 'Helper function for GEO audit RLS - checks if user can access audit via org membership, ownership, or internal status';
