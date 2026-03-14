-- Fix: invite SELECT RLS policy uses case-sensitive email comparison.
-- Invite emails are stored lowercase, but JWT email claim preserves original casing.
-- This causes "Invite Not Found" when the user's email has uppercase characters.

-- Also fix: UPDATE policy only allows admins, but non-admin invitees need to
-- update their own invite (mark as accepted) after accepting.

DROP POLICY IF EXISTS "Users can view invites" ON invites;
CREATE POLICY "Users can view invites"
  ON invites FOR SELECT
  USING (
    LOWER(email) = LOWER((SELECT (SELECT auth.jwt()) ->> 'email'))
    OR organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- Allow invitees to update their own invite (to mark it as accepted)
DROP POLICY IF EXISTS "Admins can update invites" ON invites;
DROP POLICY IF EXISTS "Users can update their own invites" ON invites;
CREATE POLICY "Users can update their own invites"
  ON invites FOR UPDATE
  USING (
    LOWER(email) = LOWER((SELECT (SELECT auth.jwt()) ->> 'email'))
    OR organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
