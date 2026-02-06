-- ============================================================
-- SHARED LINKS: Generic sharing for any resource type
-- Replaces report-specific report_shares with a universal system
-- ============================================================

-- Create shared_links table
CREATE TABLE shared_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resource identification
  resource_type text NOT NULL CHECK (resource_type IN ('report', 'site_audit', 'performance_audit', 'aio_audit')),
  resource_id uuid NOT NULL,

  -- Share token (appears in URL: /s/{token})
  token text UNIQUE NOT NULL,

  -- Security settings
  expires_at timestamptz NOT NULL,
  password_hash text,  -- bcrypt hash, null if no password
  max_views integer DEFAULT 50,

  -- Tracking
  view_count integer DEFAULT 0,
  last_viewed_at timestamptz,

  -- Ownership
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,

  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shared_links_token ON shared_links(token);
CREATE INDEX idx_shared_links_resource ON shared_links(resource_type, resource_id);
CREATE INDEX idx_shared_links_expires ON shared_links(expires_at);
CREATE INDEX idx_shared_links_org ON shared_links(organization_id);

-- Enable RLS
ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES FOR shared_links
-- ============================================================

-- SELECT: Users can view shares for their org or their own, internal users see all
CREATE POLICY "Users can view their shared links"
ON shared_links FOR SELECT
USING (
  organization_id = public.get_user_organization_id()
  OR created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- INSERT: Users can create shares for their org or as one-time (null org)
CREATE POLICY "Users can create shared links"
ON shared_links FOR INSERT
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND (
    organization_id = public.get_user_organization_id()
    OR organization_id IS NULL
  )
);

-- UPDATE: Creator or internal users can update
CREATE POLICY "Users can update their shared links"
ON shared_links FOR UPDATE
USING (
  created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- DELETE: Creator or internal users can delete
CREATE POLICY "Users can delete their shared links"
ON shared_links FOR DELETE
USING (
  created_by = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = (SELECT auth.uid())
    AND is_internal = true
  )
);

-- ============================================================
-- SECURITY DEFINER FUNCTIONS FOR PUBLIC ACCESS
-- ============================================================

-- Validate a shared link token (check expiry, view limit, password requirement)
CREATE OR REPLACE FUNCTION validate_shared_link(share_token text)
RETURNS TABLE (
  resource_type text,
  resource_id uuid,
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
  link_record shared_links%ROWTYPE;
BEGIN
  -- Find the link by token
  SELECT * INTO link_record
  FROM shared_links
  WHERE token = share_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::uuid, false, false, 'not_found'::text;
    RETURN;
  END IF;

  -- Check expiration
  IF link_record.expires_at < now() THEN
    RETURN QUERY SELECT link_record.resource_type, link_record.resource_id, false, false, 'expired'::text;
    RETURN;
  END IF;

  -- Check view limit
  IF link_record.view_count >= link_record.max_views THEN
    RETURN QUERY SELECT link_record.resource_type, link_record.resource_id, false, false, 'view_limit_exceeded'::text;
    RETURN;
  END IF;

  -- Valid - return resource info and whether password is required
  RETURN QUERY SELECT
    link_record.resource_type,
    link_record.resource_id,
    true,
    link_record.password_hash IS NOT NULL,
    NULL::text;
END;
$$;

-- Access a shared link (validates, checks password, increments view count)
-- Returns resource_type + resource_id only — app layer fetches the actual resource data
CREATE OR REPLACE FUNCTION access_shared_link(share_token text, provided_password text DEFAULT NULL)
RETURNS TABLE (
  resource_type text,
  resource_id uuid,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link_record shared_links%ROWTYPE;
BEGIN
  -- Find the link by token
  SELECT * INTO link_record
  FROM shared_links
  WHERE token = share_token;

  -- Token not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::text, NULL::uuid, 'not_found'::text;
    RETURN;
  END IF;

  -- Check expiration
  IF link_record.expires_at < now() THEN
    RETURN QUERY SELECT link_record.resource_type, link_record.resource_id, 'expired'::text;
    RETURN;
  END IF;

  -- Check view limit
  IF link_record.view_count >= link_record.max_views THEN
    RETURN QUERY SELECT link_record.resource_type, link_record.resource_id, 'view_limit_exceeded'::text;
    RETURN;
  END IF;

  -- Check password if required
  IF link_record.password_hash IS NOT NULL THEN
    IF provided_password IS NULL THEN
      RETURN QUERY SELECT link_record.resource_type, link_record.resource_id, 'password_required'::text;
      RETURN;
    END IF;
    IF NOT (link_record.password_hash = crypt(provided_password, link_record.password_hash)) THEN
      RETURN QUERY SELECT link_record.resource_type, link_record.resource_id, 'invalid_password'::text;
      RETURN;
    END IF;
  END IF;

  -- Increment view count and update last viewed
  UPDATE shared_links
  SET view_count = view_count + 1, last_viewed_at = now()
  WHERE id = link_record.id;

  -- Return resource info (app layer fetches actual data)
  RETURN QUERY SELECT link_record.resource_type, link_record.resource_id, NULL::text;
END;
$$;

-- Grant execute to anon and authenticated for public access
GRANT EXECUTE ON FUNCTION validate_shared_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION access_shared_link(text, text) TO anon, authenticated;

-- ============================================================
-- CLEANUP TRIGGERS: Delete shared_links when resources are deleted
-- ============================================================

CREATE OR REPLACE FUNCTION delete_shared_links_for_resource()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM shared_links
  WHERE resource_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER delete_shared_links_on_site_audit_delete
  AFTER DELETE ON site_audits
  FOR EACH ROW
  EXECUTE FUNCTION delete_shared_links_for_resource();

CREATE TRIGGER delete_shared_links_on_performance_audit_delete
  AFTER DELETE ON performance_audits
  FOR EACH ROW
  EXECUTE FUNCTION delete_shared_links_for_resource();

CREATE TRIGGER delete_shared_links_on_aio_audit_delete
  AFTER DELETE ON aio_audits
  FOR EACH ROW
  EXECUTE FUNCTION delete_shared_links_for_resource();

CREATE TRIGGER delete_shared_links_on_generated_report_delete
  AFTER DELETE ON generated_reports
  FOR EACH ROW
  EXECUTE FUNCTION delete_shared_links_for_resource();

-- ============================================================
-- MIGRATE EXISTING DATA FROM report_shares
-- ============================================================

-- Copy existing report_shares into shared_links
INSERT INTO shared_links (
  id,
  resource_type,
  resource_id,
  token,
  expires_at,
  password_hash,
  max_views,
  view_count,
  last_viewed_at,
  created_by,
  organization_id,
  created_at
)
SELECT
  rs.id,
  'report',
  rs.report_id,
  rs.token,
  rs.expires_at,
  rs.password_hash,
  rs.max_views,
  rs.view_count,
  rs.last_viewed_at,
  gr.created_by,
  gr.organization_id,
  rs.created_at
FROM report_shares rs
JOIN generated_reports gr ON gr.id = rs.report_id;

-- ============================================================
-- DOCUMENTATION
-- ============================================================

COMMENT ON TABLE shared_links IS 'Generic shareable links for any resource type (reports, audits) with expiration, password, and view limits';
COMMENT ON COLUMN shared_links.resource_type IS 'Type of shared resource: report, site_audit, performance_audit, aio_audit';
COMMENT ON COLUMN shared_links.resource_id IS 'UUID of the shared resource';
COMMENT ON COLUMN shared_links.token IS 'Unique token for public URL: /s/{token}';
COMMENT ON COLUMN shared_links.password_hash IS 'bcrypt hash of password, null if no password required';
COMMENT ON COLUMN shared_links.max_views IS 'Maximum number of views allowed (default 50)';

COMMENT ON FUNCTION validate_shared_link IS 'Validates a share token without incrementing view count (for checking password requirement)';
COMMENT ON FUNCTION access_shared_link IS 'Validates token, checks password, increments view count, and returns resource type + ID';
