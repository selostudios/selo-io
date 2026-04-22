-- marketing_review_style_memos
-- Per-organization free-form style memo that the narrative learner updates after
-- each publish. Mirrors marketing_review_prompt_overrides for auth and shape, but
-- stores a single text blob rather than per-block JSON.

create table public.marketing_review_style_memos (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  memo text not null default '',
  source text not null default 'auto' check (source in ('auto', 'manual')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.marketing_review_style_memos enable row level security;

create policy "Org members can view style memo"
  on public.marketing_review_style_memos for select to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memos.organization_id
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

create policy "Org admins and internal users can manage style memo"
  on public.marketing_review_style_memos for all to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memos.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  )
  with check (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memos.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

-- Add ai_originals to snapshots so the learner can re-analyze any published
-- snapshot, not just the latest draft (drafts get overwritten each quarter).
alter table public.marketing_review_snapshots
  add column ai_originals jsonb;

grant select, insert, update, delete on public.marketing_review_style_memos to authenticated;
