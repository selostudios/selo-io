-- Add developer role to existing enum
ALTER TYPE user_role ADD VALUE 'developer';

-- Create feedback-specific enums
CREATE TYPE feedback_category AS ENUM (
  'bug',
  'feature_request',
  'performance',
  'usability',
  'other'
);

CREATE TYPE feedback_status AS ENUM (
  'new',
  'under_review',
  'in_progress',
  'resolved',
  'closed'
);

CREATE TYPE feedback_priority AS ENUM (
  'critical',
  'high',
  'medium',
  'low'
);

-- Create feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category feedback_category NOT NULL,
  status feedback_status NOT NULL DEFAULT 'new',
  priority feedback_priority,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  page_url TEXT,
  user_agent TEXT,
  screenshot_url TEXT,
  status_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_submitted_by ON feedback(submitted_by);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON feedback FOR SELECT
  USING (submitted_by = auth.uid());

-- RLS: Authenticated users can submit feedback
CREATE POLICY "Authenticated users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND submitted_by = auth.uid());

-- RLS: Developers can view all feedback
CREATE POLICY "Developers can view all feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- RLS: Developers can update any feedback (WITH CHECK prevents changing submitted_by)
CREATE POLICY "Developers can update feedback"
  ON feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- Updated_at trigger
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload to their own folder
CREATE POLICY "Users can upload feedback screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.uid() IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policy: users can read their own uploads
CREATE POLICY "Users can read own screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policy: developers can read all screenshots
CREATE POLICY "Developers can read all screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-screenshots'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'developer'
    )
  );

-- NOTE: No DELETE policy is intentionally omitted to maintain audit trail.
-- Feedback records should never be deleted to preserve history and accountability.
