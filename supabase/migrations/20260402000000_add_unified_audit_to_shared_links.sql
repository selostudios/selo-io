-- Add 'unified_audit' to the shared_links resource_type check constraint

ALTER TABLE shared_links
  DROP CONSTRAINT shared_links_resource_type_check;

ALTER TABLE shared_links
  ADD CONSTRAINT shared_links_resource_type_check
  CHECK (resource_type IN ('report', 'site_audit', 'performance_audit', 'aio_audit', 'unified_audit'));

-- Cleanup trigger for unified audit deletions
CREATE TRIGGER delete_shared_links_on_audit_delete
  AFTER DELETE ON audits
  FOR EACH ROW
  EXECUTE FUNCTION delete_shared_links_for_resource();
