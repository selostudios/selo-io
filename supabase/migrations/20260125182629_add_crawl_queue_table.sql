-- Crawl queue for batch processing
CREATE TABLE site_audit_crawl_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  depth INTEGER DEFAULT 0,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  crawled_at TIMESTAMPTZ,
  UNIQUE(audit_id, url)
);

CREATE INDEX idx_crawl_queue_pending ON site_audit_crawl_queue(audit_id)
  WHERE crawled_at IS NULL;

-- RLS
ALTER TABLE site_audit_crawl_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON site_audit_crawl_queue
  FOR ALL USING (true) WITH CHECK (true);
