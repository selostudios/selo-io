-- Add unique constraint on invites.email
-- Only one invite per email address should exist at a time
-- When resending invites, we extend the expiry rather than creating new records

-- First, clean up any duplicate emails (keep the most recent one)
DELETE FROM invites a
USING invites b
WHERE a.email = b.email
  AND a.created_at < b.created_at;

-- Now add the unique constraint
ALTER TABLE invites ADD CONSTRAINT invites_email_unique UNIQUE (email);
