-- Add last_modified column to site_audit_pages
ALTER TABLE site_audit_pages ADD COLUMN last_modified timestamptz;
