-- marketing_review_style_memo_versions
-- Append-only version history for the per-organization style memo. Each row
-- captures one state of the memo: either an auto-learner run (tied to the
-- triggering snapshot) or a manual edit from the settings card. The singleton
-- `marketing_review_style_memos` remains the authoritative current state; this
-- table is the durable audit log that powers the settings timeline and the
-- snapshot-detail learner callout.

create table public.marketing_review_style_memo_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid references public.marketing_review_snapshots(id) on delete set null,
  memo text not null,
  rationale text,
  source text not null check (source in ('auto', 'manual')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.marketing_review_style_memo_versions (organization_id, created_at desc);
create index on public.marketing_review_style_memo_versions (snapshot_id);

alter table public.marketing_review_style_memo_versions enable row level security;

create policy "Org members can view memo versions"
  on public.marketing_review_style_memo_versions for select to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memo_versions.organization_id
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

create policy "Org admins and internal users can insert memo versions"
  on public.marketing_review_style_memo_versions for insert to authenticated
  with check (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memo_versions.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

grant select, insert on public.marketing_review_style_memo_versions to authenticated;
