-- Migration: Create marketing_review_prompt_overrides table with RLS
--
-- Stores per-organization overrides of the AI narrative prompts used for
-- quarterly marketing reviews. The prompts JSONB maps narrative block keys
-- (cover_subtitle, ga_summary, linkedin_insights, initiatives, takeaways,
-- planning) to the override text for that block. Missing keys fall back
-- to the compiled-in defaults in lib/reviews/narrative/prompts.ts.

create table public.marketing_review_prompt_overrides (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  prompts jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.marketing_review_prompt_overrides enable row level security;

create policy "Org members can view prompt overrides"
  on public.marketing_review_prompt_overrides
  for select
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_prompt_overrides.organization_id
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  );

create policy "Org admins and internal users can manage prompt overrides"
  on public.marketing_review_prompt_overrides
  for all
  to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_prompt_overrides.organization_id
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
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_prompt_overrides.organization_id
        and tm.role = 'admin'
    )
    or exists (
      select 1 from users u
      where u.id = (select auth.uid())
        and u.is_internal = true
    )
  );

grant select, insert, update, delete on public.marketing_review_prompt_overrides to authenticated;
