-- Create dismissed_checks table to track human-overridden checks
CREATE TABLE dismissed_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  check_name TEXT NOT NULL,
  url TEXT NOT NULL,
  dismissed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one dismissal per check per URL per org
  UNIQUE(organization_id, check_name, url)
);

-- Create index for efficient lookups during audit runs
CREATE INDEX idx_dismissed_checks_lookup
  ON dismissed_checks(organization_id, check_name, url);

-- Enable RLS
ALTER TABLE dismissed_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage dismissed checks for their organization
CREATE POLICY "Users can view dismissed checks for their organization"
  ON dismissed_checks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create dismissed checks for their organization"
  ON dismissed_checks FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete dismissed checks for their organization"
  ON dismissed_checks FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
