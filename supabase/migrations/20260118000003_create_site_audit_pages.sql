-- Create site_audit_pages table
CREATE TABLE site_audit_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  status_code integer,
  crawled_at timestamptz DEFAULT now()
);

-- Add RLS policies (inherit from parent audit)
ALTER TABLE site_audit_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pages from their audits"
ON site_audit_pages FOR SELECT
USING (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert pages to their audits"
ON site_audit_pages FOR INSERT
WITH CHECK (
  audit_id IN (
    SELECT id FROM site_audits WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  )
);

-- Create index
CREATE INDEX idx_site_audit_pages_audit ON site_audit_pages(audit_id);
