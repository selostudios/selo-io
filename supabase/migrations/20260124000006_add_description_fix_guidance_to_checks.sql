-- Add missing columns to site_audit_checks
ALTER TABLE site_audit_checks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE site_audit_checks ADD COLUMN IF NOT EXISTS fix_guidance text;
