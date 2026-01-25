-- Add project_id to site_audits (nullable for backward compatibility)
ALTER TABLE site_audits
  ADD COLUMN project_id UUID REFERENCES seo_projects(id) ON DELETE SET NULL;

-- Add project_id to performance_audits (nullable for backward compatibility)
ALTER TABLE performance_audits
  ADD COLUMN project_id UUID REFERENCES seo_projects(id) ON DELETE SET NULL;

-- Create indexes for faster queries by project
CREATE INDEX idx_site_audits_project ON site_audits(project_id);
CREATE INDEX idx_performance_audits_project ON performance_audits(project_id);
