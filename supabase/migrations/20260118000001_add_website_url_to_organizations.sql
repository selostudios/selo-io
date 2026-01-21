-- Add website_url column to organizations
ALTER TABLE organizations
ADD COLUMN website_url text;

-- Add comment for documentation
COMMENT ON COLUMN organizations.website_url IS 'Primary website URL for SEO/AIO auditing';
