-- Fix RLS policy for performance_audit_results to support one-time audits
-- One-time audits have organization_id = NULL and should be accessible by their creator

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view their organization's performance results" ON performance_audit_results;

-- Create new policy that handles both organization audits and one-time audits
CREATE POLICY "Users can view their organization's and own performance results"
ON performance_audit_results FOR SELECT
USING (
  audit_id IN (
    SELECT pa.id
    FROM performance_audits pa
    INNER JOIN users u ON u.id = auth.uid()
    WHERE
      -- Organization audits: user's org matches audit's org
      pa.organization_id = u.organization_id
      -- One-time audits: user created the audit
      OR (pa.organization_id IS NULL AND pa.created_by = auth.uid())
      -- Internal users: can see all audits
      OR u.is_internal = true
      -- Admins and developers: can see all audits
      OR u.role IN ('admin', 'developer')
  )
);
