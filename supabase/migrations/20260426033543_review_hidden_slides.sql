-- Migration: Add hidden_slides column to marketing_review_drafts and snapshots
--
-- Authors can hide individual narrative slides from the published deck while
-- keeping their data in the draft. The column stores the narrative-block keys
-- (ga_summary, linkedin_insights, content_highlights, initiatives, takeaways,
-- planning) that should be skipped at render time.
--
-- The cover slide is always shown; cover_subtitle is rejected at the action
-- layer rather than via a CHECK constraint so we can evolve the slide set
-- without re-migrating.
--
-- Snapshots receive a frozen copy of the draft's hidden_slides at publish
-- time so the published deck remains stable independent of later edits.

alter table public.marketing_review_drafts
  add column hidden_slides text[] not null default '{}';

alter table public.marketing_review_snapshots
  add column hidden_slides text[] not null default '{}';

comment on column public.marketing_review_drafts.hidden_slides is
  'Narrative-block keys (ga_summary, linkedin_insights, content_highlights, initiatives, takeaways, planning) the author has hidden from the deck. cover_subtitle is rejected at the action layer.';
comment on column public.marketing_review_snapshots.hidden_slides is
  'Frozen copy of the draft hidden_slides at publish time.';
