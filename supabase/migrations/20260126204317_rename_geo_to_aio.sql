-- Rename AIO (Generative Engine Optimization) to AIO (Artificial Intelligence Optimization)

-- 1. Rename tables
ALTER TABLE aio_audits RENAME TO aio_audits;
ALTER TABLE aio_checks RENAME TO aio_checks;
ALTER TABLE aio_ai_analyses RENAME TO aio_ai_analyses;

-- 2. Rename column in aio_audits
ALTER TABLE aio_audits RENAME COLUMN overall_aio_score TO overall_aio_score;

-- 3. Rename constraints
ALTER TABLE aio_audits RENAME CONSTRAINT aio_audits_status_check TO aio_audits_status_check;
ALTER TABLE aio_checks RENAME CONSTRAINT aio_checks_category_check TO aio_checks_category_check;
ALTER TABLE aio_checks RENAME CONSTRAINT aio_checks_priority_check TO aio_checks_priority_check;
ALTER TABLE aio_checks RENAME CONSTRAINT aio_checks_status_check TO aio_checks_status_check;

-- 4. Rename indexes for aio_audits
ALTER INDEX idx_aio_audits_org RENAME TO idx_aio_audits_org;
ALTER INDEX idx_aio_audits_created_by RENAME TO idx_aio_audits_created_by;
ALTER INDEX idx_aio_audits_status RENAME TO idx_aio_audits_status;
ALTER INDEX idx_aio_audits_created_at RENAME TO idx_aio_audits_created_at;

-- 5. Rename indexes for aio_checks
ALTER INDEX idx_aio_checks_audit RENAME TO idx_aio_checks_audit;
ALTER INDEX idx_aio_checks_category RENAME TO idx_aio_checks_category;
ALTER INDEX idx_aio_checks_status RENAME TO idx_aio_checks_status;

-- 6. Rename indexes for aio_ai_analyses
ALTER INDEX idx_aio_ai_analyses_audit RENAME TO idx_aio_ai_analyses_audit;
ALTER INDEX idx_aio_ai_analyses_url RENAME TO idx_aio_ai_analyses_url;
ALTER INDEX idx_aio_ai_analyses_overall_score RENAME TO idx_aio_ai_analyses_overall_score;

-- 7. Drop and recreate RLS policies for aio_audits (policies can't be renamed)
DROP POLICY IF EXISTS "Users can view their org's AIO audits" ON aio_audits;
DROP POLICY IF EXISTS "Users can insert AIO audits for their org" ON aio_audits;
DROP POLICY IF EXISTS "Users can update their AIO audits" ON aio_audits;
DROP POLICY IF EXISTS "Users can delete their AIO audits" ON aio_audits;

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

-- 8. Drop and recreate RLS policies for aio_checks
DROP POLICY IF EXISTS "Users can view checks from their audits" ON aio_checks;
DROP POLICY IF EXISTS "Service role can insert AIO checks" ON aio_checks;
DROP POLICY IF EXISTS "Service role can update AIO checks" ON aio_checks;
DROP POLICY IF EXISTS "Service role can delete AIO checks" ON aio_checks;

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

-- 9. Drop and recreate RLS policies for aio_ai_analyses
DROP POLICY IF EXISTS "Users can view AI analyses from their audits" ON aio_ai_analyses;
DROP POLICY IF EXISTS "Service role can insert AI analyses" ON aio_ai_analyses;
DROP POLICY IF EXISTS "Service role can update AI analyses" ON aio_ai_analyses;
DROP POLICY IF EXISTS "Service role can delete AI analyses" ON aio_ai_analyses;

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

-- 10. Update table comments
COMMENT ON TABLE aio_audits IS 'AIO (Artificial Intelligence Optimization) audit records with programmatic and AI analysis results';
COMMENT ON TABLE aio_checks IS 'Programmatic check results for AIO audits (technical, structure, content quality checks)';
COMMENT ON TABLE aio_ai_analyses IS 'AI-powered content quality analysis from Claude Opus 4.5 using structured Zod schemas';

-- 11. Update column comments
COMMENT ON COLUMN aio_audits.sample_size IS 'Number of pages analyzed by AI (1-10, user configurable)';
COMMENT ON COLUMN aio_audits.total_cost IS 'Total API cost in USD for AI analysis';
COMMENT ON COLUMN aio_checks.category IS 'AIO framework category: technical_foundation, content_structure, or content_quality';
COMMENT ON COLUMN aio_ai_analyses.findings IS 'Structured JSONB from AIOPageAnalysisSchema validation';
COMMENT ON COLUMN aio_ai_analyses.recommendations IS 'Array of prioritized recommendations with learn more URLs';
