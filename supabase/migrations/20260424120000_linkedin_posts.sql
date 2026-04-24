-- LinkedIn posts for quarterly performance report "top posts" slide
CREATE TABLE linkedin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform_connection_id uuid NOT NULL REFERENCES platform_connections(id) ON DELETE CASCADE,
  linkedin_urn text NOT NULL,
  posted_at timestamptz NOT NULL,
  caption text,
  post_url text,
  thumbnail_path text,
  post_type text NOT NULL CHECK (post_type IN ('image', 'video', 'text', 'article', 'poll')),
  impressions integer NOT NULL DEFAULT 0,
  reactions integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  engagement_rate numeric,
  analytics_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX linkedin_posts_org_urn_key
  ON linkedin_posts(organization_id, linkedin_urn);

CREATE INDEX linkedin_posts_org_posted_at_idx
  ON linkedin_posts(organization_id, posted_at DESC);

ALTER TABLE linkedin_posts ENABLE ROW LEVEL SECURITY;

-- Mirror the campaign_metrics RLS policy: members of the org can read,
-- and internal Selo employees can view across orgs for support/debugging.
CREATE POLICY "linkedin_posts_select_team_members" ON linkedin_posts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM team_members WHERE user_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_internal_user())
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users: the sync pipeline
-- uses the service client which bypasses RLS.

grant select on public.linkedin_posts to authenticated;
