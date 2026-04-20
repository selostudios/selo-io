-- Migration: Create marketing_review_drafts table with RLS
--
-- Drafts are the editable working state of a marketing_review. There is
-- exactly one draft row per review (enforced by the UNIQUE on review_id),
-- which admins edit until they publish — publishing freezes the draft's
-- current contents into a new marketing_review_snapshots row and leaves
-- the draft in place for further editing.
--
-- ai_originals stores the AI-generated narrative blocks verbatim so we can
-- detect human edits and preserve the original for regeneration.

create table public.marketing_review_drafts (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.marketing_reviews(id) on delete cascade,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}',
  narrative jsonb not null default '{}',
  ai_originals jsonb not null default '{}'
);

alter table public.marketing_review_drafts enable row level security;

create policy "Org members can view marketing review drafts"
  on public.marketing_review_drafts
  for select
  to authenticated
  using (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_drafts.review_id
        and tm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  );

create policy "Org admins and internal users can manage marketing review drafts"
  on public.marketing_review_drafts
  for all
  to authenticated
  using (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_drafts.review_id
        and tm.user_id = (select auth.uid())
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  )
  with check (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_drafts.review_id
        and tm.user_id = (select auth.uid())
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  );

grant select, insert, update, delete on public.marketing_review_drafts to authenticated;
