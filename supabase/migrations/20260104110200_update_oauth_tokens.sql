-- Create function to atomically update OAuth tokens in JSONB credentials
CREATE OR REPLACE FUNCTION update_oauth_tokens(
  p_connection_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_org_id uuid;
  v_connection_org_id uuid;
BEGIN
  -- Get the user's organization from their team_members entry
  SELECT organization_id INTO v_user_org_id
  FROM team_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Get the connection's organization
  SELECT organization_id INTO v_connection_org_id
  FROM platform_connections
  WHERE id = p_connection_id;

  -- Verify user owns this connection
  IF v_user_org_id IS NULL OR v_user_org_id != v_connection_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update connection for different organization';
  END IF;

  -- Perform the update
  UPDATE platform_connections
  SET
    credentials = jsonb_set(
      jsonb_set(
        jsonb_set(
          credentials,
          '{access_token}',
          to_jsonb(p_access_token)
        ),
        '{refresh_token}',
        to_jsonb(p_refresh_token)
      ),
      '{expires_at}',
      to_jsonb(p_expires_at)
    ),
    updated_at = now()
  WHERE id = p_connection_id;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION update_oauth_tokens IS 'Atomically updates OAuth tokens in platform_connections credentials JSONB, preserving other credential fields. Enforces multi-tenant security by verifying user organization matches connection organization.';
