-- Add name field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Update the get_organization_user_emails function to also return names
CREATE OR REPLACE FUNCTION public.get_organization_user_emails(org_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id as user_id,
    au.email as email,
    COALESCE(u.name, au.raw_user_meta_data->>'full_name', SPLIT_PART(au.email, '@', 1)) as name
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.organization_id = org_id;
$$;
