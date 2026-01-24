-- Add updated_at column to site_audits table for stale audit detection
ALTER TABLE site_audits
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_site_audits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update on row changes
DROP TRIGGER IF EXISTS set_site_audits_updated_at ON site_audits;
CREATE TRIGGER set_site_audits_updated_at
  BEFORE UPDATE ON site_audits
  FOR EACH ROW
  EXECUTE FUNCTION update_site_audits_updated_at();

-- Backfill existing rows with created_at as their updated_at
UPDATE site_audits SET updated_at = created_at WHERE updated_at IS NULL;

-- Mark any stuck audits (in crawling/checking for over 10 minutes) as failed
UPDATE site_audits
SET
  status = 'failed',
  error_message = 'Audit timed out - the server function was terminated before completion.',
  completed_at = now()
WHERE
  status IN ('crawling', 'checking')
  AND (now() - COALESCE(updated_at, created_at)) > interval '10 minutes';
