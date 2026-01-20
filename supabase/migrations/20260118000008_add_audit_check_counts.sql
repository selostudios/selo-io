-- Add check count columns to site_audits
ALTER TABLE site_audits ADD COLUMN failed_count integer NOT NULL DEFAULT 0;
ALTER TABLE site_audits ADD COLUMN warning_count integer NOT NULL DEFAULT 0;
ALTER TABLE site_audits ADD COLUMN passed_count integer NOT NULL DEFAULT 0;
