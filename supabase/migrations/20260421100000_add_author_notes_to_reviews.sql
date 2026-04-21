-- Migration: Add author_notes column to marketing_review_drafts and marketing_review_snapshots
--
-- Author notes are free-form context the report author supplies before the
-- AI generates the narrative (e.g. "last quarter we ran a large campaign,
-- so a drop in sessions this quarter is expected"). They are fed into the
-- narrative prompts as first-class context so the AI can weave the author's
-- explanations into bullets, but they are not rendered in the deck itself.
--
-- Stored on the draft (editable) and copied into each snapshot at publish
-- time so historical snapshots stay fully reproducible.

alter table public.marketing_review_drafts
  add column author_notes text;

alter table public.marketing_review_snapshots
  add column author_notes text;

comment on column public.marketing_review_drafts.author_notes is
  'Optional free-form context supplied by the report author. Fed to the AI as prompt context; not rendered in the deck.';

comment on column public.marketing_review_snapshots.author_notes is
  'Author notes captured at publish time, copied from the draft.';
