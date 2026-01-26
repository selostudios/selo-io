-- Create a database function to perform audit cleanup in a single transaction
-- This reduces 6 round trips to 1 and ensures atomic cleanup operations

CREATE OR REPLACE FUNCTION public.cleanup_old_audit_data()
RETURNS TABLE(
  deleted_checks bigint,
  deleted_pages bigint,
  deleted_audits bigint,
  deleted_queue_entries bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  six_months_ago timestamp with time zone;
  thirty_days_ago timestamp with time zone;
  v_deleted_checks bigint;
  v_deleted_pages bigint;
  v_deleted_audits bigint;
  v_deleted_queue_entries bigint;
BEGIN
  -- Calculate cutoff dates
  six_months_ago := NOW() - INTERVAL '6 months';
  thirty_days_ago := NOW() - INTERVAL '30 days';

  -- 1. Delete checks from audits older than 6 months
  WITH old_audits AS (
    SELECT id FROM site_audits
    WHERE completed_at < six_months_ago
    AND status IN ('completed', 'stopped')
  )
  DELETE FROM site_audit_checks
  WHERE audit_id IN (SELECT id FROM old_audits);

  GET DIAGNOSTICS v_deleted_checks = ROW_COUNT;

  -- 2. Delete pages from audits older than 6 months
  WITH old_audits AS (
    SELECT id FROM site_audits
    WHERE completed_at < six_months_ago
    AND status IN ('completed', 'stopped')
  )
  DELETE FROM site_audit_pages
  WHERE audit_id IN (SELECT id FROM old_audits);

  GET DIAGNOSTICS v_deleted_pages = ROW_COUNT;

  -- 3. Delete one-time audits older than 30 days entirely
  -- Cascade will handle related checks/pages deletion
  DELETE FROM site_audits
  WHERE organization_id IS NULL
  AND completed_at < thirty_days_ago
  AND status IN ('completed', 'stopped', 'failed');

  GET DIAGNOSTICS v_deleted_audits = ROW_COUNT;

  -- 4. Clean up orphaned crawl queue entries
  DELETE FROM site_audit_crawl_queue
  WHERE discovered_at < thirty_days_ago;

  GET DIAGNOSTICS v_deleted_queue_entries = ROW_COUNT;

  -- Return results
  RETURN QUERY SELECT v_deleted_checks, v_deleted_pages, v_deleted_audits, v_deleted_queue_entries;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_data() TO service_role;

COMMENT ON FUNCTION public.cleanup_old_audit_data() IS
  'Performs periodic cleanup of old audit data. Deletes checks/pages from audits older than 6 months, ' ||
  'deletes one-time audits older than 30 days, and cleans up orphaned crawl queue entries. ' ||
  'Designed to be called by the audit-cleanup cron job.';
