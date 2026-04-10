-- Add research mode columns to ai_visibility_results
ALTER TABLE ai_visibility_results
  ADD COLUMN IF NOT EXISTS research_id UUID,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'sync',
  ADD COLUMN IF NOT EXISTS insight TEXT;

-- Make prompt_id nullable (research results don't have a prompt)
ALTER TABLE ai_visibility_results
  ALTER COLUMN prompt_id DROP NOT NULL;

-- Index for polling research results by research_id
CREATE INDEX IF NOT EXISTS idx_ai_visibility_results_research_id
  ON ai_visibility_results (research_id)
  WHERE research_id IS NOT NULL;

-- Add check constraint for source values
ALTER TABLE ai_visibility_results
  ADD CONSTRAINT ai_visibility_results_source_check
  CHECK (source IN ('sync', 'research'));
