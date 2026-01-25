-- Add batch tracking columns
ALTER TABLE site_audits ADD COLUMN current_batch INTEGER DEFAULT 0;
ALTER TABLE site_audits ADD COLUMN urls_discovered INTEGER DEFAULT 0;

-- Update status constraint to include batch_complete
ALTER TABLE site_audits DROP CONSTRAINT IF EXISTS site_audits_status_check;
ALTER TABLE site_audits ADD CONSTRAINT site_audits_status_check
  CHECK (status IN ('pending', 'crawling', 'batch_complete', 'checking', 'completed', 'failed', 'stopped'));
