-- Add 'marketing_review' to the shared_links resource_type CHECK constraint so
-- Performance Reports (Phase 4) can create public share links that point at a
-- marketing_review_snapshots row. Without this value the CHECK constraint
-- rejects every INSERT made by the ShareModal flow, breaking the public-share
-- feature entirely — not just the tests.
--
-- Preserves every existing value: report, site_audit, performance_audit,
-- aio_audit, unified_audit. Only adds 'marketing_review' alongside them.

ALTER TABLE shared_links
  DROP CONSTRAINT shared_links_resource_type_check;

ALTER TABLE shared_links
  ADD CONSTRAINT shared_links_resource_type_check
  CHECK (resource_type IN (
    'report',
    'site_audit',
    'performance_audit',
    'aio_audit',
    'unified_audit',
    'marketing_review'
  ));

-- Cascade-delete shared_links rows when their underlying snapshot is removed.
-- Mirrors the triggers wired in 20260206000000_create_shared_links_table.sql
-- for the other resource types so shared_links never point at a missing row.
CREATE TRIGGER delete_shared_links_on_marketing_review_snapshot_delete
  AFTER DELETE ON marketing_review_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION delete_shared_links_for_resource();

COMMENT ON COLUMN shared_links.resource_type IS
  'Type of shared resource: report, site_audit, performance_audit, aio_audit, unified_audit, marketing_review';
