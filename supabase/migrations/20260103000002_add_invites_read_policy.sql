-- Allow users to read invites sent to their email address
CREATE POLICY "Users can read invites sent to their email"
  ON invites FOR SELECT
  USING (email = auth.jwt() ->> 'email');
