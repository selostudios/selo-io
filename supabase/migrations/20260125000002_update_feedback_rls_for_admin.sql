-- Update feedback RLS policies to allow admin role in addition to developer

-- Drop existing developer-only policies
DROP POLICY IF EXISTS "Developers can view all feedback" ON feedback;
DROP POLICY IF EXISTS "Developers can update feedback" ON feedback;

-- Create new policies that include both admin and developer roles
CREATE POLICY "Admins and developers can view all feedback"
  ON feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'developer')
    )
  );

CREATE POLICY "Admins and developers can update feedback"
  ON feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'developer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'developer')
    )
  );

-- Update storage policies to allow admins to read all screenshots
DROP POLICY IF EXISTS "Developers can read all screenshots" ON storage.objects;

CREATE POLICY "Admins and developers can read all screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'feedback-screenshots'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'developer')
    )
  );
