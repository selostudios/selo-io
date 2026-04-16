-- =============================================================================
-- Database optimization: indexes, autovacuum tuning, pg_trgm
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. pg_trgm extension for efficient ILIKE searches
-- ---------------------------------------------------------------------------
-- ai_visibility_results.response_text is searched with %term% ILIKE patterns.
-- Without a trigram index, every ILIKE causes a full sequential scan.
create extension if not exists pg_trgm;

create index idx_ai_vis_results_response_trgm
  on ai_visibility_results using gin (response_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2. GIN indexes on JSONB columns queried with containment operators
-- ---------------------------------------------------------------------------
-- audit_ai_analyses stores structured AI analysis results in JSONB columns.
-- Any @> or ? queries on these columns need GIN indexes to avoid seq scans.
create index idx_audit_ai_analyses_findings
  on audit_ai_analyses using gin (findings);

create index idx_audit_ai_analyses_platform_readiness
  on audit_ai_analyses using gin (platform_readiness);

-- ai_visibility_results.competitor_mentions is queried for competitor analysis
create index idx_ai_vis_results_competitor_mentions
  on ai_visibility_results using gin (competitor_mentions);

-- ---------------------------------------------------------------------------
-- 3. Partial index on audit_checks for failed/warning (hot dashboard path)
-- ---------------------------------------------------------------------------
-- Dashboards and audit detail pages frequently filter checks by status.
-- Most checks are 'passed'; indexing only issues keeps the index small.
create index idx_audit_checks_issues
  on audit_checks (audit_id) where status in ('failed', 'warning');

-- ---------------------------------------------------------------------------
-- 4. Composite index on performance_audit_results for device-filtered queries
-- ---------------------------------------------------------------------------
-- Queries commonly filter by (audit_id, device) for mobile vs desktop views.
create index idx_perf_results_audit_device
  on performance_audit_results (audit_id, device);

-- ---------------------------------------------------------------------------
-- 5. Partial index on audits for active/in-progress statuses
-- ---------------------------------------------------------------------------
-- Polling endpoints and audit list pages filter for non-terminal statuses.
-- Most audits are completed/failed; indexing only active ones is smaller.
create index idx_audits_active_status
  on audits (updated_at desc)
  where status in ('pending', 'crawling', 'checking', 'analyzing', 'batch_complete', 'awaiting_confirmation');

-- ---------------------------------------------------------------------------
-- 6. Autovacuum tuning for high-churn tables
-- ---------------------------------------------------------------------------
-- These tables see frequent INSERT/DELETE cycles (audit cleanup, daily syncs).
-- Default autovacuum thresholds (20% scale factor) are too high — dead tuples
-- accumulate and bloat the table before vacuum kicks in.

alter table audit_checks set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

alter table audit_pages set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

alter table campaign_metrics set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

alter table ai_visibility_results set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
