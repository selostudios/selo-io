-- Rename name column to first_name
ALTER TABLE users RENAME COLUMN name TO first_name;

-- Add last_name column
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Update the get_organization_user_emails function to return first and last names
DROP FUNCTION IF EXISTS public.get_organization_user_emails(UUID);

CREATE OR REPLACE FUNCTION public.get_organization_user_emails(org_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id as user_id,
    au.email as email,
    COALESCE(u.first_name, au.raw_user_meta_data->>'first_name', SPLIT_PART(au.email, '@', 1)) as first_name,
    COALESCE(u.last_name, au.raw_user_meta_data->>'last_name', '') as last_name
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.organization_id = org_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_organization_user_emails(UUID) TO authenticated;
