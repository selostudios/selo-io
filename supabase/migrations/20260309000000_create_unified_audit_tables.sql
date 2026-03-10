-- Create unified audit tables
-- These tables replace the separate site_audits, aio_audits, and performance_audits tables
-- with a single unified schema that supports all audit types.

-- =============================================================================
-- 1. ENUM TYPE
-- =============================================================================

CREATE TYPE unified_audit_status AS ENUM (
  'pending',
  'crawling',
  'awaiting_confirmation',
  'checking',
  'completed',
  'failed',
  'stopped',
  'batch_complete'
);

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- Main audits table
CREATE TABLE audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  domain text NOT NULL,
  url text NOT NULL,
  status unified_audit_status NOT NULL DEFAULT 'pending',
  seo_score integer,
  performance_score integer,
  ai_readiness_score integer,
  overall_score integer,
  pages_crawled integer NOT NULL DEFAULT 0,
  crawl_mode text NOT NULL DEFAULT 'standard',
  max_pages integer NOT NULL DEFAULT 50,
  soft_cap_reached boolean NOT NULL DEFAULT false,
  passed_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  ai_analysis_enabled boolean NOT NULL DEFAULT true,
  sample_size integer NOT NULL DEFAULT 5,
  total_input_tokens integer NOT NULL DEFAULT 0,
  total_output_tokens integer NOT NULL DEFAULT 0,
  total_cost decimal NOT NULL DEFAULT 0,
  use_relaxed_ssl boolean NOT NULL DEFAULT false,
  executive_summary text,
  error_message text,
  progress jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Audit pages
CREATE TABLE audit_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  meta_description text,
  status_code integer,
  last_modified timestamptz,
  is_resource boolean NOT NULL DEFAULT false,
  resource_type text,
  depth integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit checks
CREATE TABLE audit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  page_url text,
  category text NOT NULL,
  check_name text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  display_name text NOT NULL,
  display_name_passed text NOT NULL,
  description text NOT NULL,
  fix_guidance text,
  learn_more_url text,
  details jsonb,
  feeds_scores text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit crawl queue
CREATE TABLE audit_crawl_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  url text NOT NULL,
  depth integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit AI analyses
CREATE TABLE audit_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  importance_score integer NOT NULL DEFAULT 0,
  importance_reasons text[] NOT NULL DEFAULT '{}',
  score_data_quality integer,
  score_expert_credibility integer,
  score_comprehensiveness integer,
  score_citability integer,
  score_authority integer,
  score_overall integer,
  findings jsonb,
  recommendations jsonb,
  platform_readiness jsonb,
  citability_passages jsonb,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost decimal NOT NULL DEFAULT 0,
  execution_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. INDEXES
-- =============================================================================

CREATE INDEX idx_audits_org ON audits(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_audits_created_by ON audits(created_by) WHERE organization_id IS NULL;
CREATE INDEX idx_audits_domain ON audits(domain);
CREATE INDEX idx_audits_status ON audits(status);
CREATE INDEX idx_audit_checks_audit ON audit_checks(audit_id);
CREATE INDEX idx_audit_checks_category ON audit_checks(audit_id, category);
CREATE INDEX idx_audit_checks_status ON audit_checks(audit_id, status);
CREATE INDEX idx_audit_pages_audit ON audit_pages(audit_id);
CREATE INDEX idx_audit_ai_analyses_audit ON audit_ai_analyses(audit_id);
CREATE INDEX idx_audit_crawl_queue_audit_status ON audit_crawl_queue(audit_id, status);

-- =============================================================================
-- 4. UPDATED_AT TRIGGER
-- =============================================================================

-- Reuse existing update_updated_at_column() function from the project
CREATE TRIGGER update_audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_crawl_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_ai_analyses ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- audits policies
-- -----------------------------------------------------------------------------

-- SELECT: org members, one-time audit owners, internal users
CREATE POLICY "Users can view audits"
  ON audits FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
    OR
    (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
  );

-- INSERT: org admins, one-time audit creators, internal users
CREATE POLICY "Users can insert audits"
  ON audits FOR INSERT
  WITH CHECK (
    (organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'))
    OR
    (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
  );

-- DELETE: org admins, one-time audit owners, internal users
CREATE POLICY "Users can delete audits"
  ON audits FOR DELETE
  USING (
    (organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
      AND EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND role = 'admin'))
    OR
    (organization_id IS NULL AND created_by = (SELECT auth.uid()))
    OR
    EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
  );

-- -----------------------------------------------------------------------------
-- audit_pages policies
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view audit pages"
  ON audit_pages FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can insert audit pages"
  ON audit_pages FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can delete audit pages"
  ON audit_pages FOR DELETE
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

-- -----------------------------------------------------------------------------
-- audit_checks policies
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view audit checks"
  ON audit_checks FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can insert audit checks"
  ON audit_checks FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can delete audit checks"
  ON audit_checks FOR DELETE
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

-- -----------------------------------------------------------------------------
-- audit_crawl_queue policies
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view audit crawl queue"
  ON audit_crawl_queue FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can insert audit crawl queue"
  ON audit_crawl_queue FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can delete audit crawl queue"
  ON audit_crawl_queue FOR DELETE
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

-- -----------------------------------------------------------------------------
-- audit_ai_analyses policies
-- -----------------------------------------------------------------------------

CREATE POLICY "Users can view audit AI analyses"
  ON audit_ai_analyses FOR SELECT
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can insert audit AI analyses"
  ON audit_ai_analyses FOR INSERT
  WITH CHECK (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

CREATE POLICY "Users can delete audit AI analyses"
  ON audit_ai_analyses FOR DELETE
  USING (
    audit_id IN (
      SELECT id FROM audits
      WHERE organization_id IN (SELECT organization_id FROM users WHERE id = (SELECT auth.uid()))
        OR (organization_id IS NULL AND created_by = (SELECT auth.uid()))
        OR EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_internal = true)
    )
  );

-- =============================================================================
-- 6. COMMENTS
-- =============================================================================

COMMENT ON TABLE audits IS 'Unified audit records combining SEO, performance, and AI-readiness audits';
COMMENT ON TABLE audit_pages IS 'Pages discovered during audit crawling';
COMMENT ON TABLE audit_checks IS 'Individual check results for audits (page-specific or site-wide)';
COMMENT ON TABLE audit_crawl_queue IS 'URL queue for audit crawling process';
COMMENT ON TABLE audit_ai_analyses IS 'AI-powered content analysis results per page';

COMMENT ON COLUMN audits.organization_id IS 'NULL for one-time (quick) audits';
COMMENT ON COLUMN audits.created_by IS 'Owner of one-time audits; used for RLS when organization_id is NULL';
COMMENT ON COLUMN audits.crawl_mode IS 'standard (respect soft cap) or exhaustive (crawl all discoverable pages)';
COMMENT ON COLUMN audits.progress IS 'JSONB tracking phased execution progress for batch processing';
COMMENT ON COLUMN audit_checks.feeds_scores IS 'Score dimensions this check contributes to (seo, performance, ai_readiness)';
COMMENT ON COLUMN audit_checks.page_url IS 'NULL for site-wide checks that apply to the entire domain';
