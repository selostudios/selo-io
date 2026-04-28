-- Migration: Add slide_notes jsonb column to marketing_review_drafts and snapshots
--
-- Authors can attach a per-slide note (one per narrative block) describing
-- what the AI should keep in mind for that slide — e.g. "the dip in Feb is
-- intentional, we paused paid ads" or "AI keeps using marketing jargon here,
-- prefer plain English". The notes are quarter-specific (they live on the
-- draft and are frozen onto the snapshot at publish time), but the style memo
-- learner reads them so durable patterns can be promoted into the cross-quarter
-- memo.
--
-- The column is keyed by narrative-block key (cover_subtitle, ga_summary,
-- linkedin_insights, content_highlights, initiatives, takeaways, planning).
-- Empty / missing keys mean "no note for this slide".

alter table public.marketing_review_drafts
  add column slide_notes jsonb not null default '{}';

alter table public.marketing_review_snapshots
  add column slide_notes jsonb not null default '{}';

comment on column public.marketing_review_drafts.slide_notes is
  'Per-slide author notes for the style-memo learner, keyed by narrative block key (cover_subtitle, ga_summary, linkedin_insights, content_highlights, initiatives, takeaways, planning).';
comment on column public.marketing_review_snapshots.slide_notes is
  'Frozen copy of the draft slide_notes at publish time.';
