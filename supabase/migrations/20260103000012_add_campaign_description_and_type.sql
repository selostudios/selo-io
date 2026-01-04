-- Add description and type fields to campaigns table

-- Create campaign type enum
CREATE TYPE campaign_type AS ENUM (
  'thought_leadership',
  'product_launch',
  'brand_awareness',
  'lead_generation',
  'event_promotion',
  'seasonal',
  'other'
);

-- Add columns to campaigns table
ALTER TABLE campaigns
ADD COLUMN description TEXT,
ADD COLUMN type campaign_type DEFAULT 'other';
