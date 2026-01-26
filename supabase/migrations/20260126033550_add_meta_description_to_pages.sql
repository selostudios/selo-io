-- Add meta_description column to site_audit_pages table
-- This enables duplicate meta description detection

ALTER TABLE site_audit_pages
ADD COLUMN meta_description TEXT;

-- Add index for duplicate detection queries
CREATE INDEX idx_site_audit_pages_meta_description
ON site_audit_pages (audit_id, meta_description)
WHERE meta_description IS NOT NULL;

COMMENT ON COLUMN site_audit_pages.meta_description IS 'Meta description tag content extracted from page HTML';
