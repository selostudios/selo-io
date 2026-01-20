-- Add error_message column to site_audits
ALTER TABLE site_audits ADD COLUMN error_message text;

-- Update status constraint to include 'checking' status
ALTER TABLE site_audits DROP CONSTRAINT site_audits_status_check;
ALTER TABLE site_audits
ADD CONSTRAINT site_audits_status_check
CHECK (status IN ('pending', 'crawling', 'checking', 'completed', 'failed'));
