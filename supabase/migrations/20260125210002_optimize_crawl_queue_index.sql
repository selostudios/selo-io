-- Optimize crawl queue index to match query pattern
-- The batch crawler queries: ORDER BY depth ASC, discovered_at ASC
-- So we need a composite index that includes these columns

-- Drop the existing partial index
DROP INDEX IF EXISTS idx_crawl_queue_pending;

-- Create an optimized composite index that matches the query pattern:
-- 1. audit_id for filtering
-- 2. depth for sorting
-- 3. discovered_at for secondary sorting
-- 4. Only for pending items (crawled_at IS NULL)
CREATE INDEX idx_crawl_queue_pending ON site_audit_crawl_queue(audit_id, depth, discovered_at)
  WHERE crawled_at IS NULL;
