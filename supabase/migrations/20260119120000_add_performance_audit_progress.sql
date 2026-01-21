-- Add progress tracking fields to performance_audits
ALTER TABLE performance_audits
ADD COLUMN current_url text,
ADD COLUMN current_device text CHECK (current_device IS NULL OR current_device IN ('mobile', 'desktop')),
ADD COLUMN total_urls integer DEFAULT 0,
ADD COLUMN completed_count integer DEFAULT 0;
