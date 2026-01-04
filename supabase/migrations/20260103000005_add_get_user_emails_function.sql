-- Create a security definer function to get user emails for team members
-- This allows regular users to see emails of people in their organization
CREATE OR REPLACE FUNCTION public.get_organization_user_emails(org_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT
    u.id as user_id,
    au.email as email
  FROM public.users u
  JOIN auth.users au ON au.id = u.id
  WHERE u.organization_id = org_id;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_organization_user_emails(UUID) TO authenticated;
