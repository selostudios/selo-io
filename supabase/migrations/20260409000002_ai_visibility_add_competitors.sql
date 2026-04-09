-- Add competitors configuration to AI visibility configs.
-- Stores array of { name: string, domain: string } objects.
ALTER TABLE ai_visibility_configs
ADD COLUMN competitors JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN ai_visibility_configs.competitors IS 'Array of competitor objects: [{ "name": "Zenni Optical", "domain": "zenni.com" }]';
