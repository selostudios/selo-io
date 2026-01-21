-- Create site_audits table
CREATE TABLE site_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  overall_score integer,
  seo_score integer,
  ai_readiness_score integer,
  technical_score integer,
  pages_crawled integer DEFAULT 0,
  executive_summary text,
  archived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add check constraint for status
ALTER TABLE site_audits
ADD CONSTRAINT site_audits_status_check
CHECK (status IN ('pending', 'crawling', 'completed', 'failed'));

-- Add RLS policies
ALTER TABLE site_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's audits"
ON site_audits FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert audits for their organization"
ON site_audits FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their organization's audits"
ON site_audits FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_site_audits_org ON site_audits(organization_id);
CREATE INDEX idx_site_audits_archived ON site_audits(organization_id, archived_at);
