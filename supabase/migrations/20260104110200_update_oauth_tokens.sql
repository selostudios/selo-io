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
BEGIN
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
COMMENT ON FUNCTION update_oauth_tokens IS 'Atomically updates OAuth tokens in platform_connections credentials JSONB, preserving other credential fields';
