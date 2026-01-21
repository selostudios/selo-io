-- Add resource identification fields to site_audit_pages
ALTER TABLE site_audit_pages ADD COLUMN is_resource boolean DEFAULT false;
ALTER TABLE site_audit_pages ADD COLUMN resource_type text;

-- Add check constraint for resource_type
ALTER TABLE site_audit_pages
ADD CONSTRAINT site_audit_pages_resource_type_check
CHECK (resource_type IS NULL OR resource_type IN ('pdf', 'document', 'spreadsheet', 'presentation', 'archive', 'image', 'other'));
