-- Add 'stopped' status to performance_audits CHECK constraint
ALTER TABLE performance_audits DROP CONSTRAINT IF EXISTS performance_audits_status_check;
ALTER TABLE performance_audits ADD CONSTRAINT performance_audits_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped'));
