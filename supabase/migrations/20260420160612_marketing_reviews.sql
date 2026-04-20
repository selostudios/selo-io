-- Migration: Create marketing_reviews table with RLS
--
-- The marketing_reviews table is the top-level row per org+quarter for the
-- Performance Reports feature. Admins create a review, edit as a draft, then
-- publish as an immutable snapshot.
--
-- The latest_snapshot_id FK will be added in a subsequent migration after
-- the marketing_review_snapshots table exists.

create table public.marketing_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  quarter text not null,  -- e.g. '2026-Q1'
  latest_snapshot_id uuid,  -- FK set after snapshots table exists
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quarter)
);

create index marketing_reviews_org_idx on public.marketing_reviews(organization_id);

alter table public.marketing_reviews enable row level security;

create policy "Org members can view marketing reviews"
  on public.marketing_reviews
  for select
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_reviews.organization_id
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  );

create policy "Org admins and internal users can insert marketing reviews"
  on public.marketing_reviews
  for insert
  to authenticated
  with check (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_reviews.organization_id
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid()) and u.is_internal = true
    )
  );

create policy "Org admins and internal users can update marketing reviews"
  on public.marketing_reviews
  for update
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_reviews.organization_id
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true
    )
  );

create policy "Org admins and internal users can delete marketing reviews"
  on public.marketing_reviews
  for delete
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_reviews.organization_id
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true
    )
  );

grant select, insert, update, delete on public.marketing_reviews to authenticated;
