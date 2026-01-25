-- Add column to persist SSL relaxed mode across batches
ALTER TABLE site_audits ADD COLUMN use_relaxed_ssl BOOLEAN DEFAULT FALSE;
