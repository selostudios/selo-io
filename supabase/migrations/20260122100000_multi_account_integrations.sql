-- Multi-account integrations support
-- Allows multiple connections per platform per organization

-- 1. Drop the unique constraint that limits one connection per platform
ALTER TABLE platform_connections DROP CONSTRAINT IF EXISTS platform_connections_organization_id_platform_type_key;

-- 2. Add new columns for account identification
ALTER TABLE platform_connections
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 3. Populate account_name from existing credentials for current connections
UPDATE platform_connections
SET account_name = credentials->>'organization_name'
WHERE account_name IS NULL
  AND credentials->>'organization_name' IS NOT NULL;

-- 4. Add unique constraint to prevent duplicate connections to same account
-- Uses (organization_id, platform_type, account_name) to allow multiple accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_connections_unique_account
  ON platform_connections(organization_id, platform_type, account_name)
  WHERE account_name IS NOT NULL;

-- 5. Add index for querying by organization and platform
CREATE INDEX IF NOT EXISTS idx_platform_connections_org_platform
  ON platform_connections(organization_id, platform_type);
