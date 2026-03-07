-- Add missing indexes on audit status columns (frequently filtered in queries)
CREATE INDEX IF NOT EXISTS idx_site_audits_status ON site_audits(status);
CREATE INDEX IF NOT EXISTS idx_performance_audits_status ON performance_audits(status);
-- aio_audits already has idx_aio_audits_status from rename migration
