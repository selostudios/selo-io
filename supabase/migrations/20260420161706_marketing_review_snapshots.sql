-- Migration: Create marketing_review_snapshots table with immutable RLS
--
-- Snapshots are the published, frozen versions of a marketing_review. Each
-- publish creates a new snapshot row with incrementing version. Snapshots
-- are intentionally NEVER mutable after insert — no UPDATE policy exists,
-- and no DELETE policy exists, so the only way a snapshot row leaves the
-- table is via ON DELETE CASCADE when its parent review is deleted.
--
-- This migration also back-fills the latest_snapshot_id FK on
-- marketing_reviews now that the snapshots table exists.

create table public.marketing_review_snapshots (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.marketing_reviews(id) on delete cascade,
  version int not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references auth.users(id),

  period_start date not null,
  period_end date not null,
  compare_qoq_start date not null,
  compare_qoq_end date not null,
  compare_yoy_start date not null,
  compare_yoy_end date not null,

  data jsonb not null,       -- frozen metrics
  narrative jsonb not null,  -- frozen narrative blocks

  share_token text not null unique,

  unique (review_id, version)
);

create index marketing_review_snapshots_review_idx
  on public.marketing_review_snapshots(review_id);

-- Back-fill FK now that snapshots exists
alter table public.marketing_reviews
  add constraint marketing_reviews_latest_snapshot_fk
  foreign key (latest_snapshot_id)
  references public.marketing_review_snapshots(id)
  on delete set null;

alter table public.marketing_review_snapshots enable row level security;

create policy "Org members can view marketing review snapshots"
  on public.marketing_review_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_snapshots.review_id
        and tm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  );

-- INSERT-only: admins and internal users. No UPDATE or DELETE policy =
-- snapshots are immutable once inserted.
create policy "Org admins and internal users can insert marketing review snapshots"
  on public.marketing_review_snapshots
  for insert
  to authenticated
  with check (
    exists (
      select 1 from marketing_reviews mr
      join team_members tm on tm.organization_id = mr.organization_id
      where mr.id = marketing_review_snapshots.review_id
        and tm.user_id = (select auth.uid())
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  );

grant select, insert on public.marketing_review_snapshots to authenticated;
