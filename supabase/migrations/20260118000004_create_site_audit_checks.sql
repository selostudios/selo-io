-- Create site_audit_checks table
CREATE TABLE site_audit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  page_id uuid REFERENCES site_audit_pages(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  check_name text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add check constraints
ALTER TABLE site_audit_checks
ADD CONSTRAINT site_audit_checks_type_check
CHECK (check_type IN ('seo', 'ai_readiness', 'technical'));

ALTER TABLE site_audit_checks
ADD CONSTRAINT site_audit_checks_priority_check
CHECK (priority IN ('critical', 'recommended', 'optional'));

ALTER TABLE site_audit_checks
ADD CONSTRAINT site_audit_checks_status_check
CHECK (status IN ('passed', 'failed', 'warning'));

-- Add RLS policies
ALTER TABLE site_audit_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checks from their audits"
ON site_audit_checks FOR SELECT
USING (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert checks to their audits"
ON site_audit_checks FOR INSERT
WITH CHECK (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Create indexes
CREATE INDEX idx_site_audit_checks_audit ON site_audit_checks(audit_id);
CREATE INDEX idx_site_audit_checks_page ON site_audit_checks(page_id);
