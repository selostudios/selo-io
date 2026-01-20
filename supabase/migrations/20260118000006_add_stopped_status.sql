-- Update status constraint to include 'stopped' status
ALTER TABLE site_audits DROP CONSTRAINT site_audits_status_check;
ALTER TABLE site_audits
ADD CONSTRAINT site_audits_status_check
CHECK (status IN ('pending', 'crawling', 'checking', 'completed', 'failed', 'stopped'));
