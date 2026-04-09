-- ==========================================================================
-- AI Visibility Tables
-- ==========================================================================

-- 1. ai_visibility_configs — one per organization
CREATE TABLE ai_visibility_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  sync_frequency TEXT NOT NULL DEFAULT 'daily',
  platforms TEXT[] NOT NULL DEFAULT ARRAY['chatgpt', 'claude', 'perplexity'],
  is_active BOOLEAN NOT NULL DEFAULT false,
  monthly_budget_cents INTEGER NOT NULL DEFAULT 10000,
  budget_alert_threshold INTEGER NOT NULL DEFAULT 90,
  last_alert_sent_at TIMESTAMPTZ,
  last_alert_type TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_configs_select"
  ON ai_visibility_configs FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_configs_insert"
  ON ai_visibility_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) = 'admin'
  );

CREATE POLICY "ai_visibility_configs_update"
  ON ai_visibility_configs FOR UPDATE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) = 'admin')
    OR (SELECT public.is_internal_user())
  );

GRANT SELECT, INSERT, UPDATE ON ai_visibility_configs TO authenticated;

-- 2. ai_visibility_topics
CREATE TABLE ai_visibility_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_topics_select"
  ON ai_visibility_topics FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_topics_insert"
  ON ai_visibility_topics FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) IN ('admin', 'team_member')
  );

CREATE POLICY "ai_visibility_topics_update"
  ON ai_visibility_topics FOR UPDATE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_topics_delete"
  ON ai_visibility_topics FOR DELETE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE INDEX idx_ai_visibility_topics_org ON ai_visibility_topics (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_visibility_topics TO authenticated;

-- 3. ai_visibility_prompts
CREATE TABLE ai_visibility_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES ai_visibility_topics(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_prompts_select"
  ON ai_visibility_prompts FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_prompts_insert"
  ON ai_visibility_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.get_user_organization_id()) = organization_id
    AND (SELECT public.get_user_role()) IN ('admin', 'team_member')
  );

CREATE POLICY "ai_visibility_prompts_update"
  ON ai_visibility_prompts FOR UPDATE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE POLICY "ai_visibility_prompts_delete"
  ON ai_visibility_prompts FOR DELETE
  TO authenticated
  USING (
    (organization_id = (SELECT public.get_user_organization_id())
      AND (SELECT public.get_user_role()) IN ('admin', 'team_member'))
    OR (SELECT public.is_internal_user())
  );

CREATE INDEX idx_ai_visibility_prompts_org ON ai_visibility_prompts (organization_id);
CREATE INDEX idx_ai_visibility_prompts_topic ON ai_visibility_prompts (topic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_visibility_prompts TO authenticated;

-- 4. ai_visibility_results
CREATE TABLE ai_visibility_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES ai_visibility_prompts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  response_text TEXT NOT NULL,
  brand_mentioned BOOLEAN NOT NULL DEFAULT false,
  brand_sentiment TEXT NOT NULL DEFAULT 'neutral',
  brand_position INTEGER,
  domain_cited BOOLEAN NOT NULL DEFAULT false,
  cited_urls TEXT[],
  competitor_mentions JSONB,
  tokens_used INTEGER,
  cost_cents INTEGER,
  queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_results_select"
  ON ai_visibility_results FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

-- No INSERT/UPDATE/DELETE policies — service client writes bypass RLS

CREATE INDEX idx_ai_visibility_results_org_date
  ON ai_visibility_results (organization_id, queried_at DESC);
CREATE INDEX idx_ai_visibility_results_prompt
  ON ai_visibility_results (prompt_id, queried_at DESC);
CREATE INDEX idx_ai_visibility_results_platform
  ON ai_visibility_results (platform, queried_at DESC);

GRANT SELECT ON ai_visibility_results TO authenticated;

-- 5. ai_visibility_scores
CREATE TABLE ai_visibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  mentions_count INTEGER NOT NULL DEFAULT 0,
  citations_count INTEGER NOT NULL DEFAULT 0,
  cited_pages_count INTEGER NOT NULL DEFAULT 0,
  platform_breakdown JSONB,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ai_visibility_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_visibility_scores_select"
  ON ai_visibility_scores FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT public.get_user_organization_id())
    OR (SELECT public.is_internal_user())
  );

-- No INSERT/UPDATE/DELETE policies — service client writes bypass RLS

CREATE INDEX idx_ai_visibility_scores_org_period
  ON ai_visibility_scores (organization_id, period_end DESC);

GRANT SELECT ON ai_visibility_scores TO authenticated;
