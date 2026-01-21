-- Add developer role to existing user_role enum
-- This must be in a separate migration because new enum values
-- cannot be used in the same transaction they are added
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'developer';
