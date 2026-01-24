-- Migration: Final RLS fixes
-- 1. Fix auth.jwt() wrapper in invites policy
-- 2. Split ALL policies into separate INSERT/UPDATE/DELETE to avoid SELECT overlap

-- ============================================================================
-- INVITES TABLE - Fix auth.jwt() and split policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view invites" ON invites;
DROP POLICY IF EXISTS "Admins can manage invites" ON invites;

-- Single SELECT policy with all auth calls wrapped
CREATE POLICY "Users can view invites"
  ON invites FOR SELECT
  USING (
    email = (SELECT (SELECT auth.jwt()) ->> 'email')
    OR organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- Separate INSERT/UPDATE/DELETE policies (not ALL, to avoid SELECT overlap)
CREATE POLICY "Admins can insert invites"
  ON invites FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update invites"
  ON invites FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete invites"
  ON invites FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- ============================================================================
-- CAMPAIGNS TABLE - Split ALL policy to avoid SELECT overlap
-- ============================================================================

DROP POLICY IF EXISTS "Admins and team members can manage campaigns" ON campaigns;

CREATE POLICY "Admins and team members can insert campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'team_member')
    )
  );

CREATE POLICY "Admins and team members can update campaigns"
  ON campaigns FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'team_member')
    )
  );

CREATE POLICY "Admins and team members can delete campaigns"
  ON campaigns FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'team_member')
    )
  );

-- ============================================================================
-- PLATFORM_CONNECTIONS TABLE - Split ALL policy to avoid SELECT overlap
-- ============================================================================

DROP POLICY IF EXISTS "Admins can manage platform connections" ON platform_connections;

CREATE POLICY "Admins can insert platform connections"
  ON platform_connections FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update platform connections"
  ON platform_connections FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete platform connections"
  ON platform_connections FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users
      WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
