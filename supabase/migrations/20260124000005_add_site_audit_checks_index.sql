-- Add index on site_audit_checks for faster queries
-- Queries filter by audit_id and order by created_at, so composite index is optimal
CREATE INDEX IF NOT EXISTS idx_site_audit_checks_audit_created
ON public.site_audit_checks (audit_id, created_at);
