-- Create performance_audits table (audit runs)
CREATE TABLE performance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create performance_audit_results table (per-page results)
CREATE TABLE performance_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES performance_audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  device text NOT NULL CHECK (device IN ('mobile', 'desktop')),

  -- Core Web Vitals (from CrUX field data when available)
  lcp_ms integer,
  lcp_rating text CHECK (lcp_rating IS NULL OR lcp_rating IN ('good', 'needs_improvement', 'poor')),
  inp_ms integer,
  inp_rating text CHECK (inp_rating IS NULL OR inp_rating IN ('good', 'needs_improvement', 'poor')),
  cls_score numeric(5,3),
  cls_rating text CHECK (cls_rating IS NULL OR cls_rating IN ('good', 'needs_improvement', 'poor')),

  -- Lighthouse scores (0-100)
  performance_score integer,
  accessibility_score integer,
  best_practices_score integer,
  seo_score integer,

  -- Raw API response for diagnostics
  raw_response jsonb,

  created_at timestamptz DEFAULT now()
);

-- Create monitored_pages table (pages to track regularly)
CREATE TABLE monitored_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, url)
);

-- Create monitored_sites table (sites for weekly auto-audit)
CREATE TABLE monitored_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  run_site_audit boolean DEFAULT true,
  run_performance_audit boolean DEFAULT true,
  last_site_audit_at timestamptz,
  last_performance_audit_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, url)
);

-- Indexes
CREATE INDEX idx_performance_audits_org ON performance_audits(organization_id);
CREATE INDEX idx_performance_audit_results_audit ON performance_audit_results(audit_id);
CREATE INDEX idx_monitored_pages_org ON monitored_pages(organization_id);
CREATE INDEX idx_monitored_sites_org ON monitored_sites(organization_id);

-- RLS policies for performance_audits
ALTER TABLE performance_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's performance audits"
ON performance_audits FOR SELECT
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert performance audits for their organization"
ON performance_audits FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their organization's performance audits"
ON performance_audits FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- RLS policies for performance_audit_results
ALTER TABLE performance_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's performance results"
ON performance_audit_results FOR SELECT
USING (audit_id IN (
  SELECT id FROM performance_audits
  WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
));

CREATE POLICY "Users can insert performance results for their audits"
ON performance_audit_results FOR INSERT
WITH CHECK (audit_id IN (
  SELECT id FROM performance_audits
  WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
));

-- RLS policies for monitored_pages
ALTER TABLE monitored_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's monitored pages"
ON monitored_pages FOR SELECT
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage their organization's monitored pages"
ON monitored_pages FOR ALL
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- RLS policies for monitored_sites
ALTER TABLE monitored_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's monitored sites"
ON monitored_sites FOR SELECT
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage their organization's monitored sites"
ON monitored_sites FOR ALL
USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
