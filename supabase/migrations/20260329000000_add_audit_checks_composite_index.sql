-- Add composite index on audit_checks(audit_id, created_at) to cover the
-- paginated detail query: WHERE audit_id = $1 ORDER BY created_at ASC
-- Without this, Postgres fetches all matching rows and sorts in memory,
-- which times out on large audits (3000+ checks).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_checks_audit_created
ON audit_checks (audit_id, created_at);

-- Drop the single-column index that is now redundant (the composite index
-- covers audit_id-only lookups as a leading prefix).
DROP INDEX IF EXISTS idx_audit_checks_audit;
