-- Migration: Allow users to update their own profile
-- This fixes the bug where users cannot update their first_name and last_name

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
