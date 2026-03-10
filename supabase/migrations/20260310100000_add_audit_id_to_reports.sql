-- Add audit_id column to generated_reports for linking to unified audits
-- The old site_audit_id, performance_audit_id, aio_audit_id columns remain
-- for backward compatibility with legacy reports

ALTER TABLE generated_reports
  ADD COLUMN IF NOT EXISTS audit_id uuid REFERENCES audits(id) ON DELETE SET NULL;

-- Make old audit columns nullable for new unified audit reports
ALTER TABLE generated_reports
  ALTER COLUMN site_audit_id DROP NOT NULL,
  ALTER COLUMN performance_audit_id DROP NOT NULL,
  ALTER COLUMN aio_audit_id DROP NOT NULL;

-- Index for looking up reports by unified audit
CREATE INDEX IF NOT EXISTS idx_generated_reports_audit_id ON generated_reports(audit_id);
