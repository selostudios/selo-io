-- Store pre-resolved robots.txt rules as JSON for efficient URL filtering during crawling
ALTER TABLE audits ADD COLUMN robots_txt_rules jsonb;
COMMENT ON COLUMN audits.robots_txt_rules IS 'Pre-resolved robots.txt rules for SeloIOBot: {rules: [{type, path}], crawlDelayMs}';
