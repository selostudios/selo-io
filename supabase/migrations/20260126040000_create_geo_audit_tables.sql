-- Create aio_audits table
CREATE TABLE aio_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',

  -- Scores
  technical_score integer CHECK (technical_score BETWEEN 0 AND 100),
  strategic_score integer CHECK (strategic_score BETWEEN 0 AND 100),
  overall_aio_score integer CHECK (overall_aio_score BETWEEN 0 AND 100),

  -- Execution metadata
  pages_analyzed integer DEFAULT 0,
  sample_size integer CHECK (sample_size BETWEEN 1 AND 10),
  execution_time_ms integer,

  -- AI metadata
  ai_analysis_enabled boolean DEFAULT false,
  total_input_tokens integer,
  total_output_tokens integer,
  total_cost decimal(10, 4),
  model_used text DEFAULT 'claude-opus-4-20250514',

  -- Status tracking
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for status
ALTER TABLE aio_audits
ADD CONSTRAINT aio_audits_status_check
CHECK (status IN ('pending', 'running', 'completed', 'failed'));

-- Add indexes for aio_audits
CREATE INDEX idx_aio_audits_org ON aio_audits(organization_id);
CREATE INDEX idx_aio_audits_created_by ON aio_audits(created_by);
CREATE INDEX idx_aio_audits_status ON aio_audits(status);
CREATE INDEX idx_aio_audits_created_at ON aio_audits(created_at DESC);

-- Create aio_checks table (programmatic results)
CREATE TABLE aio_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES aio_audits(id) ON DELETE CASCADE,
  category text NOT NULL,
  check_name text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  details jsonb,

  -- Display metadata
  display_name text,
  display_name_passed text,
  description text,
  fix_guidance text,
  learn_more_url text,

  created_at timestamptz DEFAULT now()
);

-- Add check constraints for aio_checks
ALTER TABLE aio_checks
ADD CONSTRAINT aio_checks_category_check
CHECK (category IN ('technical_foundation', 'content_structure', 'content_quality'));

ALTER TABLE aio_checks
ADD CONSTRAINT aio_checks_priority_check
CHECK (priority IN ('critical', 'recommended', 'optional'));

ALTER TABLE aio_checks
ADD CONSTRAINT aio_checks_status_check
CHECK (status IN ('passed', 'failed', 'warning'));

-- Add indexes for aio_checks
CREATE INDEX idx_aio_checks_audit ON aio_checks(audit_id);
CREATE INDEX idx_aio_checks_category ON aio_checks(audit_id, category);
CREATE INDEX idx_aio_checks_status ON aio_checks(audit_id, status);

-- Create aio_ai_analyses table
CREATE TABLE aio_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES aio_audits(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  importance_score integer,
  importance_reasons text[],

  -- Model metadata
  model_used text DEFAULT 'claude-opus-4-20250514',
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost decimal(10, 4),
  execution_time_ms integer,

  -- AI scores (0-100)
  score_data_quality integer CHECK (score_data_quality BETWEEN 0 AND 100),
  score_expert_credibility integer CHECK (score_expert_credibility BETWEEN 0 AND 100),
  score_comprehensiveness integer CHECK (score_comprehensiveness BETWEEN 0 AND 100),
  score_citability integer CHECK (score_citability BETWEEN 0 AND 100),
  score_authority integer CHECK (score_authority BETWEEN 0 AND 100),
  score_overall integer CHECK (score_overall BETWEEN 0 AND 100),

  -- Structured findings (from Zod schema)
  findings jsonb NOT NULL,
  recommendations jsonb NOT NULL,

  created_at timestamptz DEFAULT now()
);

-- Add indexes for aio_ai_analyses
CREATE INDEX idx_aio_ai_analyses_audit ON aio_ai_analyses(audit_id);
CREATE INDEX idx_aio_ai_analyses_url ON aio_ai_analyses(page_url);
CREATE INDEX idx_aio_ai_analyses_overall_score ON aio_ai_analyses(audit_id, score_overall DESC);

-- Enable RLS
ALTER TABLE aio_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE aio_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE aio_ai_analyses ENABLE ROW LEVEL SECURITY;

-- RLS policies for aio_audits
CREATE POLICY "Users can view their org's AIO audits"
ON aio_audits FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  OR created_by = auth.uid() -- Allow one-time audits
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
);

CREATE POLICY "Users can insert AIO audits for their org"
ON aio_audits FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  OR (organization_id IS NULL AND EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true
  ))
);

CREATE POLICY "Users can update their AIO audits"
ON aio_audits FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
);

CREATE POLICY "Users can delete their AIO audits"
ON aio_audits FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
);

-- RLS policies for aio_checks
CREATE POLICY "Users can view checks from their audits"
ON aio_checks FOR SELECT
USING (
  audit_id IN (
    SELECT id FROM aio_audits WHERE
      organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
  )
);

CREATE POLICY "Service role can insert AIO checks"
ON aio_checks FOR INSERT
WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY "Service role can update AIO checks"
ON aio_checks FOR UPDATE
USING (true);

CREATE POLICY "Service role can delete AIO checks"
ON aio_checks FOR DELETE
USING (true);

-- RLS policies for aio_ai_analyses
CREATE POLICY "Users can view AI analyses from their audits"
ON aio_ai_analyses FOR SELECT
USING (
  audit_id IN (
    SELECT id FROM aio_audits WHERE
      organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
      OR created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_internal = true)
  )
);

CREATE POLICY "Service role can insert AI analyses"
ON aio_ai_analyses FOR INSERT
WITH CHECK (true); -- Service role bypasses RLS

CREATE POLICY "Service role can update AI analyses"
ON aio_ai_analyses FOR UPDATE
USING (true);

CREATE POLICY "Service role can delete AI analyses"
ON aio_ai_analyses FOR DELETE
USING (true);

-- Add comments for documentation
COMMENT ON TABLE aio_audits IS 'AIO (Generative Engine Optimization) audit records with programmatic and AI analysis results';
COMMENT ON TABLE aio_checks IS 'Programmatic check results for AIO audits (technical, structure, content quality checks)';
COMMENT ON TABLE aio_ai_analyses IS 'AI-powered content quality analysis from Claude Opus 4.5 using structured Zod schemas';

COMMENT ON COLUMN aio_audits.sample_size IS 'Number of pages analyzed by AI (1-10, user configurable)';
COMMENT ON COLUMN aio_audits.total_cost IS 'Total API cost in USD for AI analysis';
COMMENT ON COLUMN aio_checks.category IS 'AIO framework category: technical_foundation, content_structure, or content_quality';
COMMENT ON COLUMN aio_ai_analyses.findings IS 'Structured JSONB from AIOPageAnalysisSchema validation';
COMMENT ON COLUMN aio_ai_analyses.recommendations IS 'Array of prioritized recommendations with learn more URLs';
