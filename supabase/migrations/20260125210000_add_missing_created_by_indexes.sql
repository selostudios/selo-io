-- Add missing indexes on created_by columns used in RLS policies
-- These indexes are critical for RLS performance when checking created_by = auth.uid()

-- Index for site_audits.created_by (used in multiple RLS policies)
CREATE INDEX IF NOT EXISTS idx_site_audits_created_by ON site_audits(created_by);

-- Index for performance_audits.created_by (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_performance_audits_created_by ON performance_audits(created_by);

-- Index for feedback.organization_id (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_feedback_organization_id ON feedback(organization_id);

-- Index for feedback.submitted_by (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_feedback_submitted_by ON feedback(submitted_by);
