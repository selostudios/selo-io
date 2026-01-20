-- Add display metadata columns to site_audit_checks
ALTER TABLE site_audit_checks ADD COLUMN display_name text;
ALTER TABLE site_audit_checks ADD COLUMN display_name_passed text;
ALTER TABLE site_audit_checks ADD COLUMN learn_more_url text;
ALTER TABLE site_audit_checks ADD COLUMN is_site_wide boolean DEFAULT false;
