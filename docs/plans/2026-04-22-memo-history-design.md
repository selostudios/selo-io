# Memo History & Rationale Design

**Status:** Design approved, awaiting merge of #24 (style memo feature) before implementation.

**Goal:** Make the self-improving style memo's evolution visible. Authors should be able to see, per published report, what the AI learned from their edits — and at any time, browse the full history of how the memo has changed.

## Context

The base style memo feature (PR #24) adds a per-organization durable style memo that is re-learned by Claude after every performance-report publish. The learner compares `ai_originals` (first AI draft) vs the human-edited final narrative, and updates `marketing_review_style_memos.memo`. Admins can also manually edit, regenerate, or clear the memo from the settings card.

Today, only the current memo is visible. There is no way to see:

- What the AI learned from a specific published report.
- How the memo has evolved over time.
- When a given piece of guidance was added, and by whom.

This design adds a version history and surfaces it in two places.

## Decisions

Captured from the Q&A session. Each was considered against two alternatives; the chosen option is recorded below without restating the rejected ones.

- **Which events create a version row:** auto-learner runs **and** manual edits from the settings card. Clears are manual edits with empty text, not a separate category.
- **Rationale format for auto runs:** one free-text sentence (≤30 words, past-tense) emitted by the learner.
- **Manual edits:** no note prompt. Timeline renders them as _"Manual edit by {admin}"_.
- **Surfaces:** snapshot detail callout (single-event, immediate feedback) **and** settings timeline (full history).
- **Backfill:** none. Timeline starts empty; first post-ship event creates the first row.
- **Public share visibility:** callout hidden on the `/s/{token}` public route. Authenticated team members see it; clients viewing a share link do not.

## Schema

One new append-only table. The existing `marketing_review_style_memos` singleton remains the authoritative "current state" source.

```sql
create table public.marketing_review_style_memo_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  snapshot_id uuid references marketing_review_snapshots(id) on delete set null,
  memo text not null,
  rationale text,
  source text not null check (source in ('auto','manual')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on marketing_review_style_memo_versions (organization_id, created_at desc);
create index on marketing_review_style_memo_versions (snapshot_id);
```

- No `prev_memo` column. The previous memo is the row immediately before this one for the same org, derivable via the composite index.
- `snapshot_id` is nullable (null for manual edits) and uses `on delete set null` so deleting a snapshot doesn't erase learning history — the timeline entry becomes "learned on a since-deleted report," which is still informative.
- Append-only. RLS grants SELECT to org members + internal, INSERT to admins + internal. No UPDATE or DELETE policies.

## Data flow

### Learner (`lib/reviews/narrative/learn.ts`)

1. Switch the Claude call from `generateText` to `generateObject` with Zod schema `{ memo: string, rationale: string }`.
2. Update the prompt to request a rationale: _"Also emit a one-sentence rationale (≤30 words), past-tense, describing what you learned and changed. Example: 'Noticed author prefers plain numbers over adverbs; reinforced that.'"_
3. After the existing upsert to `marketing_review_style_memos` succeeds, insert a version row with `source='auto'`, `snapshot_id=<triggering snapshot>`, `rationale=<learner's sentence>`, `created_by=null`.
4. **Dedupe guard:** before inserting, read the most recent version row for the org. If the new memo text exactly equals the last version's `memo`, skip the insert. Learner occasionally emits "no changes needed" passes; we don't want timeline spam.
5. New error type `'version_insert_error'` — non-fatal. Log it, then return success; the singleton is already correct and history is a nice-to-have.

### Settings actions (`app/(authenticated)/[orgId]/reports/performance/settings/actions.ts`)

- `saveStyleMemo` and `clearStyleMemo`: after updating the singleton, insert a version row with `source='manual'`, `snapshot_id=null`, `rationale=null`, `created_by=<admin user id>`. Same dedupe guard.
- `regenerateStyleMemo`: unchanged externally — it routes through `runStyleMemoLearner`, which now handles versioning.

### Write ordering

Singleton first, version row second. No DB transaction. If the version insert fails, the singleton is still correct and that's the user-visible state.

## UI surfaces

### Snapshot detail callout

- New server component `SnapshotLearnerCallout`.
- Placement: below the deck on `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapshotId]/page.tsx`.
- Fetches the auto version row for the snapshot (`WHERE snapshot_id = X AND source = 'auto' LIMIT 1`).
- Renders: title _"What the AI learned from this report,"_ rationale body, relative timestamp. Admins additionally see a _"View full history"_ link to settings.
- No row → render nothing. No placeholder clutter for pre-feature snapshots or in-flight learner runs.
- `data-testid="snapshot-learner-callout"` on the root; `snapshot-learner-callout-rationale` on the body.

### Public share route

The callout is only mounted on the authenticated page, not on `/s/{token}`. Defense in depth: versions-table RLS denies `anon` regardless.

### Settings timeline

- New server component `StyleMemoHistoryTimeline`, rendered below `<StyleMemoCard>` on the settings page.
- Fetches the 50 most recent rows for the org, joined against `marketing_review_snapshots` → `marketing_reviews` to recover `review_id` for per-row deep-links.
- Per row:
  - Relative date + full timestamp on hover.
  - Source badge: _Auto_ or _Manual_.
  - Body: rationale sentence (auto) or _"Manual edit by {admin}"_ (manual).
  - Expandable _"View memo"_ button revealing the memo text at that point in a muted bordered block.
  - _"From {Quarter} report"_ deep link when `snapshot_id` is present.
- Empty state: _"No history yet — publish a report or edit the memo to see learning events here."_
- `data-testid="style-memo-history-timeline"` on the root; per-row testids with row index.
- No pagination in v1. 50 rows is generous for ~4–8 events per org per year.

## Visibility matrix

| Surface                      | Admin | Team member | Client viewer | Public share |
| ---------------------------- | ----- | ----------- | ------------- | ------------ |
| Snapshot callout             | ✓     | ✓           | ✓             | ✗            |
| Settings timeline            | ✓     | ✓ (read)    | ✓ (read)      | n/a          |
| Memo mutation controls (existing) | ✓ | ✗ | ✗ | ✗ |

Team members can read history; only admins can mutate. Matches the existing memo card pattern.

## Testing

**Unit (Vitest):**

- Learner: new Zod schema validated; dedupe guard skips identical-memo inserts; version-insert failure tagged `version_insert_error` and non-fatal; missing API key correctly tagged `llm_error` (clears the existing log-hygiene follow-up).
- Actions: `saveStyleMemo` / `clearStyleMemo` insert version rows with correct `source` and `created_by`; dedupe prevents duplicates on repeat saves.
- Components: `SnapshotLearnerCallout` renders nothing when no row exists; `StyleMemoHistoryTimeline` renders empty state, renders rows, expand/collapse works.

**Integration (real Supabase):**

- RLS: anon blocked; team member of org A cannot see org B rows; INSERT admin-gated.
- Round-trip: stubbed-Claude `runStyleMemoLearner` invocation writes both singleton and version row with correct FK linkage.

**E2E (Playwright):**

- Extend `tests/e2e/performance-reports.spec.ts`: admin publishes → callout appears on snapshot detail page; admin edits memo in settings → new Manual row appears in timeline; public `/s/{token}` render does NOT contain the callout testid.
- Visual: add `performance-report-snapshot-with-callout.png` to `tests/e2e/visual.spec.ts`.

**Seed + fixtures:**

- New `testStyleMemoVersion` fixture with fixed UUID and ISO timestamp.
- Extend `tests/helpers/seed.ts` to insert the version row alongside the memo singleton so timeline E2E has immediate data.

## Implementation order

Suggested bite-sized tasks for the writing-plans phase:

1. Migration (table + RLS + grants + indexes).
2. Zod schema + shared types (`memo-history-types.ts`).
3. Learner: `generateObject` + dedupe + version insert.
4. Learner unit tests.
5. Actions: version insertion in save/clear + dedupe.
6. Actions integration tests (RLS + dedupe).
7. `SnapshotLearnerCallout` component + page integration.
8. `StyleMemoHistoryTimeline` component + settings page integration.
9. E2E + visual coverage.
10. Seed + fixtures.

## Post-merge handoff

Once PR #24 merges to main:

1. `git -C /Users/owainllewellyn/projects/Selo-OS checkout main && git pull`.
2. Create new worktree: `.worktrees/memo-history` on branch `feature/memo-history`.
3. This file (`docs/plans/2026-04-22-memo-history-design.md`) is currently untracked on main — move/commit it into the new worktree as the first commit.
4. Use `superpowers:writing-plans` to produce `docs/plans/2026-04-22-memo-history-implementation.md` from this design.
5. Execute with `superpowers:subagent-driven-development`.
