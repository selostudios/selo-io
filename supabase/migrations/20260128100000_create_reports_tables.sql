-- Create generated_reports table for consolidated marketing performance reports
CREATE TABLE generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Audit references (all required for a report)
  site_audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  performance_audit_id uuid NOT NULL REFERENCES performance_audits(id) ON DELETE CASCADE,
  aio_audit_id uuid NOT NULL REFERENCES aio_audits(id) ON DELETE CASCADE,

  -- Computed data
  combined_score integer CHECK (combined_score BETWEEN 0 AND 100),
  domain text NOT NULL,

  -- Executive summary (editable)
  executive_summary text,
  original_executive_summary text,

  -- White-label branding (optional, per-report)
  custom_logo_url text,
  custom_company_name text,

  -- Metadata
  view_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for generated_reports (following best practices: index FKs and common query columns)
CREATE INDEX idx_generated_reports_org ON generated_reports(organization_id);
CREATE INDEX idx_generated_reports_created_by ON generated_reports(created_by);
CREATE INDEX idx_generated_reports_domain ON generated_reports(domain);
CREATE INDEX idx_generated_reports_created_at ON generated_reports(created_at DESC);
CREATE INDEX idx_generated_reports_site_audit ON generated_reports(site_audit_id);
CREATE INDEX idx_generated_reports_performance_audit ON generated_reports(performance_audit_id);
CREATE INDEX idx_generated_reports_aio_audit ON generated_reports(aio_audit_id);

-- Create report_shares table for shareable links
CREATE TABLE report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES generated_reports(id) ON DELETE CASCADE,

  -- Share token (appears in URL: /r/{token})
  token text UNIQUE NOT NULL,

  -- Security settings
  expires_at timestamptz NOT NULL,
  password_hash text,  -- bcrypt hash, null if no password
  max_views integer DEFAULT 50,

  -- Tracking
  view_count integer DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for report_shares
CREATE INDEX idx_report_shares_report ON report_shares(report_id);
CREATE INDEX idx_report_shares_token ON report_shares(token);
CREATE INDEX idx_report_shares_expires ON report_shares(expires_at);

-- Enable RLS
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_shares ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES FOR generated_reports
-- Using optimized patterns with get_user_organization_id() helper
-- ============================================================

-- SELECT: Users can view reports for their org, their own one-time reports, or internal users can see all
CREATE POLICY "Users can view their reports"
ON generated_reports FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- INSERT: Users can create reports for their org or as one-time (null org)
CREATE POLICY "Users can create reports"
ON generated_reports FOR INSERT
WITH CHECK (
  (
    organization_id = public.get_user_organization_id()
    AND created_by = (SELECT auth.uid())
  )
  OR (
    organization_id IS NULL
    AND created_by = (SELECT auth.uid())
  )
);

-- UPDATE: Users can update their own reports or internal users can update any
CREATE POLICY "Users can update their reports"
ON generated_reports FOR UPDATE
USING (
  created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
)
WITH CHECK (
  created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- DELETE: Users can delete their own reports or internal users can delete any
CREATE POLICY "Users can delete their reports"
ON generated_reports FOR DELETE
USING (
  created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- ============================================================
-- RLS POLICIES FOR report_shares
-- ============================================================

-- SELECT: Can view shares for reports you can view
CREATE POLICY "Users can view shares for their reports"
ON report_shares FOR SELECT
USING (
  report_id IN (
    SELECT id FROM generated_reports
    WHERE organization_id = public.get_user_organization_id()
       OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
       OR EXISTS (
         SELECT 1 FROM users
         WHERE id = (SELECT auth.uid())
         AND is_internal = true
       )
  )
);

-- INSERT: Can create shares for reports you own
CREATE POLICY "Users can create shares for their reports"
ON report_shares FOR INSERT
WITH CHECK (
  report_id IN (
    SELECT id FROM generated_reports
    WHERE created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- UPDATE: Service role only (for incrementing view count on public access)
-- Users don't directly update shares - view count is updated via function
CREATE POLICY "Users can update their shares"
ON report_shares FOR UPDATE
USING (
  report_id IN (
    SELECT id FROM generated_reports
    WHERE created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- DELETE: Can delete shares for reports you own
CREATE POLICY "Users can delete their shares"
ON report_shares FOR DELETE
USING (
  report_id IN (
    SELECT id FROM generated_reports
    WHERE created_by = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- ============================================================
-- FUNCTIONS FOR PUBLIC SHARE ACCESS
-- These use SECURITY DEFINER to bypass RLS for token validation
-- ============================================================

-- Ensure pgcrypto extension is available for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to validate share token (used by public access, bypasses RLS)
CREATE OR REPLACE FUNCTION validate_share_token(share_token text)
RETURNS TABLE (
  report_id uuid,
  is_valid boolean,
  requires_password boolean,
  error_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_record report_shares%ROWTYPE;
BEGIN
  -- Find the share by token
  SELECT * INTO share_record
  FROM report_shares
  WHERE token = share_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, false, false, 'not_found'::text;
    RETURN;
  END IF;

  -- Check expiration
  IF share_record.expires_at < now() THEN
    RETURN QUERY SELECT share_record.report_id, false, false, 'expired'::text;
    RETURN;
  END IF;

  -- Check view limit
  IF share_record.view_count >= share_record.max_views THEN
    RETURN QUERY SELECT share_record.report_id, false, false, 'view_limit_exceeded'::text;
    RETURN;
  END IF;

  -- Valid - return whether password is required
  RETURN QUERY SELECT
    share_record.report_id,
    true,
    share_record.password_hash IS NOT NULL,
    NULL::text;
END;
$$;

-- Function to access shared report (validates, checks password, increments view count)
CREATE OR REPLACE FUNCTION access_shared_report(share_token text, provided_password text DEFAULT NULL)
RETURNS TABLE (
  report_data jsonb,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  share_record report_shares%ROWTYPE;
  report_record generated_reports%ROWTYPE;
BEGIN
  -- Find the share by token
  SELECT * INTO share_record
  FROM report_shares
  WHERE token = share_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::jsonb, 'not_found'::text;
    RETURN;
  END IF;

  -- Check expiration
  IF share_record.expires_at < now() THEN
    RETURN QUERY SELECT NULL::jsonb, 'expired'::text;
    RETURN;
  END IF;

  -- Check view limit
  IF share_record.view_count >= share_record.max_views THEN
    RETURN QUERY SELECT NULL::jsonb, 'view_limit_exceeded'::text;
    RETURN;
  END IF;

  -- Check password if required
  IF share_record.password_hash IS NOT NULL THEN
    IF provided_password IS NULL THEN
      RETURN QUERY SELECT NULL::jsonb, 'password_required'::text;
      RETURN;
    END IF;
    -- Use pgcrypto for password verification
    IF NOT (share_record.password_hash = crypt(provided_password, share_record.password_hash)) THEN
      RETURN QUERY SELECT NULL::jsonb, 'invalid_password'::text;
      RETURN;
    END IF;
  END IF;

  -- Get the report
  SELECT * INTO report_record
  FROM generated_reports
  WHERE id = share_record.report_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::jsonb, 'report_not_found'::text;
    RETURN;
  END IF;

  -- Increment view count and update last viewed
  UPDATE report_shares
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE id = share_record.id;

  -- Also increment report view count
  UPDATE generated_reports
  SET view_count = view_count + 1
  WHERE id = report_record.id;

  -- Return report data as JSONB
  RETURN QUERY SELECT to_jsonb(report_record), NULL::text;
END;
$$;

-- Grant execute permission to anon and authenticated for public access
GRANT EXECUTE ON FUNCTION validate_share_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION access_shared_report(text, text) TO anon, authenticated;

-- ============================================================
-- HELPER FUNCTION: Count reports using an audit
-- Used before audit deletion to warn user
-- ============================================================

CREATE OR REPLACE FUNCTION count_reports_using_audit(
  audit_type text,
  audit_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count integer;
BEGIN
  CASE audit_type
    WHEN 'site_audit' THEN
      SELECT COUNT(*) INTO report_count
      FROM generated_reports
      WHERE site_audit_id = audit_id;
    WHEN 'performance_audit' THEN
      SELECT COUNT(*) INTO report_count
      FROM generated_reports
      WHERE performance_audit_id = audit_id;
    WHEN 'aio_audit' THEN
      SELECT COUNT(*) INTO report_count
      FROM generated_reports
      WHERE aio_audit_id = audit_id;
    ELSE
      report_count := 0;
  END CASE;

  RETURN report_count;
END;
$$;

GRANT EXECUTE ON FUNCTION count_reports_using_audit(text, uuid) TO authenticated;

-- ============================================================
-- HELPER FUNCTION: Hash password for share links
-- Uses pgcrypto's crypt function with bf (blowfish) algorithm
-- ============================================================

CREATE OR REPLACE FUNCTION set_share_password(
  share_id uuid,
  password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE report_shares
  SET password_hash = crypt(password, gen_salt('bf'))
  WHERE id = share_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_share_password(uuid, text) TO authenticated;

-- ============================================================
-- DOCUMENTATION
-- ============================================================

COMMENT ON TABLE generated_reports IS 'Consolidated marketing performance reports combining SEO, PageSpeed, and AIO audits';
COMMENT ON TABLE report_shares IS 'Shareable links for reports with expiration, password protection, and view limits';

COMMENT ON COLUMN generated_reports.combined_score IS 'Weighted average: SEO(50%) + PageSpeed(30%) + AIO(20%)';
COMMENT ON COLUMN generated_reports.executive_summary IS 'Current summary text (may be edited by user)';
COMMENT ON COLUMN generated_reports.original_executive_summary IS 'Original AI-generated summary for restore functionality';
COMMENT ON COLUMN generated_reports.custom_logo_url IS 'White-label: custom logo URL for this report';
COMMENT ON COLUMN generated_reports.custom_company_name IS 'White-label: custom company name for this report';

COMMENT ON COLUMN report_shares.token IS 'Unique token for public URL: /r/{token}';
COMMENT ON COLUMN report_shares.password_hash IS 'bcrypt hash of password, null if no password required';
COMMENT ON COLUMN report_shares.max_views IS 'Maximum number of views allowed (default 50)';

COMMENT ON FUNCTION validate_share_token IS 'Validates a share token without incrementing view count (for checking password requirement)';
COMMENT ON FUNCTION access_shared_report IS 'Validates token, checks password, increments view count, and returns report data';
COMMENT ON FUNCTION count_reports_using_audit IS 'Returns count of reports using a specific audit (for deletion warning)';
