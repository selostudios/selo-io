-- Fix mutable search_path on all public functions (security linter warning)
-- Adding SET search_path = '' prevents search_path injection attacks.

-- 1. get_user_organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. is_developer
CREATE OR REPLACE FUNCTION public.is_developer()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'developer'
  );
$$;

-- 3. is_internal_user
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_internal = true
  );
$$;

-- 4. get_organization_user_emails
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
SET search_path = ''
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
GRANT EXECUTE ON FUNCTION public.get_organization_user_emails(UUID) TO authenticated;

-- 5. update_oauth_tokens
CREATE OR REPLACE FUNCTION public.update_oauth_tokens(
  p_connection_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_org_id uuid;
  v_connection_org_id uuid;
BEGIN
  SELECT organization_id INTO v_user_org_id
  FROM public.team_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  SELECT organization_id INTO v_connection_org_id
  FROM public.platform_connections
  WHERE id = p_connection_id;

  IF v_user_org_id IS NULL OR v_user_org_id != v_connection_org_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update connection for different organization';
  END IF;

  UPDATE public.platform_connections
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

-- 6. user_in_aio_audit_org
CREATE OR REPLACE FUNCTION public.user_in_aio_audit_org(audit_org_id uuid, audit_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND (
      organization_id = audit_org_id
      OR audit_created_by = auth.uid()
      OR is_internal = true
    )
  );
$$;

-- 7. cleanup_old_audit_data
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_data()
RETURNS TABLE(
  deleted_checks bigint,
  deleted_pages bigint,
  deleted_audits bigint,
  deleted_queue_entries bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  six_months_ago timestamp with time zone;
  thirty_days_ago timestamp with time zone;
  v_deleted_checks bigint;
  v_deleted_pages bigint;
  v_deleted_audits bigint;
  v_deleted_queue_entries bigint;
BEGIN
  six_months_ago := NOW() - INTERVAL '6 months';
  thirty_days_ago := NOW() - INTERVAL '30 days';

  WITH old_audits AS (
    SELECT id FROM public.site_audits
    WHERE completed_at < six_months_ago
    AND status IN ('completed', 'stopped')
  )
  DELETE FROM public.site_audit_checks
  WHERE audit_id IN (SELECT id FROM old_audits);
  GET DIAGNOSTICS v_deleted_checks = ROW_COUNT;

  WITH old_audits AS (
    SELECT id FROM public.site_audits
    WHERE completed_at < six_months_ago
    AND status IN ('completed', 'stopped')
  )
  DELETE FROM public.site_audit_pages
  WHERE audit_id IN (SELECT id FROM old_audits);
  GET DIAGNOSTICS v_deleted_pages = ROW_COUNT;

  DELETE FROM public.site_audits
  WHERE organization_id IS NULL
  AND completed_at < thirty_days_ago
  AND status IN ('completed', 'stopped', 'failed');
  GET DIAGNOSTICS v_deleted_audits = ROW_COUNT;

  DELETE FROM public.site_audit_crawl_queue
  WHERE discovered_at < thirty_days_ago;
  GET DIAGNOSTICS v_deleted_queue_entries = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_checks, v_deleted_pages, v_deleted_audits, v_deleted_queue_entries;
END;
$$;

-- 8. update_site_audits_updated_at
CREATE OR REPLACE FUNCTION public.update_site_audits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 9. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- Drop "service role" RLS policies that use USING (true) / WITH CHECK (true).
-- These are unnecessary (service client bypasses RLS) and dangerously allow
-- anon/authenticated roles unrestricted access.

-- aio_ai_analyses
DROP POLICY IF EXISTS "Service role can delete AI analyses" ON public.aio_ai_analyses;
DROP POLICY IF EXISTS "Service role can insert AI analyses" ON public.aio_ai_analyses;
DROP POLICY IF EXISTS "Service role can update AI analyses" ON public.aio_ai_analyses;

-- aio_checks
DROP POLICY IF EXISTS "Service role can delete AIO checks" ON public.aio_checks;
DROP POLICY IF EXISTS "Service role can insert AIO checks" ON public.aio_checks;
DROP POLICY IF EXISTS "Service role can update AIO checks" ON public.aio_checks;

-- site_audit_crawl_queue
DROP POLICY IF EXISTS "Service role full access" ON public.site_audit_crawl_queue;
