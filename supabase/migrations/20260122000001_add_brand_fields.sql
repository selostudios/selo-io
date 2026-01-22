-- Add brand fields for Brandfetch integration
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN organizations.social_links IS 'Array of {platform, url} objects from Brandfetch';
