# Performance Report Style Memo — Design

**Status:** Design approved 2026-04-21. Ready for implementation planning.

## Goal

Make the performance-report narrative generator self-improving. After each quarterly report is published, Claude reads the diff between its first draft and the author's final text (plus the author's notes), and updates a durable per-organization "style memo." That memo flows into every subsequent prompt as soft, learned guidance — so the AI gradually converges on how each organization's reports should sound and what data matters.

## Non-goals

- Per-author learning (memo is per-org, regardless of which admin published).
- Memo versioning or history (single row per org, latest wins).
- Structured rule extraction (`bullet_count`, `tone`, etc.) — memo stays free-form prose.
- Teaching the LLM tone for LinkedIn / HubSpot slides differently from GA.
- Feature-flagging the rollout.

## Architecture

The memo is a single free-form text block per organization, ~300–500 words, automatically updated after each publish by a background learner call to Claude. Authors can read it inline on the editor and edit it directly on the existing performance-reports settings page.

### Data model

**New table** `marketing_review_style_memos`:

| column | type | notes |
|---|---|---|
| `organization_id` | `uuid` PK, FK → `organizations.id` ON DELETE CASCADE | one row per org |
| `memo` | `text NOT NULL DEFAULT ''` | empty string until first publish |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | auto |
| `updated_by` | `uuid NULL` FK → `users.id` ON DELETE SET NULL | `NULL` when updated by the learner |
| `source` | `text NOT NULL CHECK (source IN ('auto','manual'))` | distinguishes learner output from manual edits |

RLS mirrors `marketing_review_prompt_overrides`: admins and internal users can SELECT/UPSERT/UPDATE rows whose `organization_id` matches their membership. The learner runs under the service client and bypasses RLS for the UPSERT.

**Snapshot enrichment:** add a nullable `ai_originals jsonb` column to `marketing_review_snapshots`. Today `ai_originals` only lives on `marketing_review_drafts`, which gets overwritten each quarter — after a few cycles the original AI text is lost. Freezing it onto the snapshot at publish time keeps the learning signal durable and makes the learner re-runnable against any historical snapshot.

The publish transaction copies `ai_originals` from the draft to the snapshot alongside `narrative`, `data`, and `author_notes`.

## Learning pipeline

### Trigger

Inside `publishReview()` (`lib/reviews/actions.ts`), after the snapshot INSERT commits. The learner runs via Next.js `after()` so it fires after the response has been sent — a learner failure can never block or fail a publish.

### Learner logic (`lib/reviews/narrative/learn.ts`, new)

1. Load `current_memo` for the org (empty string if no row).
2. Read the just-published snapshot's `ai_originals`, `narrative`, and `author_notes`.
3. Short-circuit: if `ai_originals === narrative` block-for-block AND `author_notes` is empty, skip. Nothing to learn.
4. For each narrative block, build a simple `"AI draft: …\nAuthor final: …"` pair. No semantic diffing — the LLM interprets.
5. Call Claude (`claude-opus-4-7`) with a focused prompt:
   - Input: current memo, per-block draft/final pairs, author notes, organization name.
   - Output: an updated memo (≤500 words), written in the voice of a style guide.
   - Rules: preserve existing entries unless new evidence clearly contradicts; express preferences softly ("tends to…"); don't invent quarter-specific facts; stay under 2000 characters.
6. UPSERT the returned memo with `source='auto'`, `updated_by=NULL`.
7. Hard cap: truncate to 2000 chars after generation.

### Error handling

- Learner throws → log `[Style Memo Error] { orgId, reviewId, snapshotId }`, leave previous memo untouched. Publish already succeeded.
- LLM returns empty/blank → skip UPSERT, log a warning.
- LLM returns >2000 chars → truncate at the last paragraph break before 2000.

### Model choice

`claude-opus-4-7` for the learner. The memo feeds every future prompt, so a bad memo compounds across quarters — quality matters more than cost. Generator currently uses `claude-opus-4-5`; bumping that is a separate follow-up.

## Prompt integration

In `lib/reviews/narrative/prompts.ts:header()`, add a new section between author notes and the block-specific instructions:

```
LEARNED STYLE (durable preferences from previous reports)
{memo text}
```

The section is **omitted entirely** when the memo is empty — no "Learned style: (none)" line to waste tokens or confuse the model.

### Precedence (documented in the footer rules)

1. This quarter's `author_notes` override the memo. If notes say "this quarter deserves deeper context" but the memo says "keep it punchy," notes win.
2. Manual prompt overrides (authored on the settings page) override the memo. Overrides are deliberate; the memo is inferred.
3. The memo **informs** rather than commands. Phrasing is soft ("This organization tends to…") not prescriptive ("You must…").

Added cost: ~500 words of memo ≈ ~700 tokens per generation. Negligible.

## Author-facing UX

### Settings page (`/reports/performance/settings`)

A new card, **Learned style memo**, above the existing prompt overrides card. Styling matches the indigo/purple accent used for the author-notes/context field so the two "AI context" surfaces visually cluster.

Contents:

- Large textarea with the current memo. Empty state: *"No style learned yet — publish your first report and Claude will start here."*
- Metadata line: *"Auto-updated from Q2 2026 snapshot on Apr 21, 2026"* or *"Edited by Owain on Apr 21, 2026"* (derived from `source` + `updated_by`).
- **Save** — persists edits, flips `source='manual'`, sets `updated_by` to the acting user.
- **Regenerate from last snapshot** — re-runs the learner against the most recent published snapshot. Useful if a publish's background learner silently failed or the author wants to refresh.
- **Clear memo** — resets to empty string (confirm dialog). Next publish bootstraps a new memo.

Access: admins + internal users only (enforced by RLS and the action-layer guard).

### Editor page (`/reports/performance/[id]`)

A collapsible panel, **"Style the AI is using,"** grouped with the author-notes / context field using the same indigo/purple accent treatment so both feel like one "AI context" cluster. Collapsed by default, showing a one-liner: *"Memo last updated Apr 21, 2026 — X words."* Expanded: shows the memo read-only with an "Edit in settings" link.

Editing is **not** available on the editor. The memo is a cross-quarter artifact; editing it while drafting a specific quarter creates confusion about when the change applies. Settings is the canonical edit surface.

### Snapshot, preview, and public share pages

No memo UI. The memo is a private authoring tool — the published report doesn't expose how it was shaped.

## Testing

### Unit (`tests/unit/lib/reviews/narrative/`)

- `learn.test.ts` — with Claude mocked:
  - no-op when `ai_originals === narrative` and `author_notes` is empty
  - respects the 2000-char cap (truncates at paragraph break)
  - preserves existing memo entries absent contradictory evidence
  - handles an empty starting memo (bootstrap case)
  - swallows LLM errors and returns the prior memo unchanged
- `prompts.test.ts`:
  - memo section appears only when non-empty
  - sits between author notes and block instructions
  - omitted entirely when empty

### Integration (`tests/integration/reviews/style-memo.test.ts`)

Round-trip against local Supabase: publish a snapshot with divergent `ai_originals` vs. final, assert memo row is created with `source='auto'`. Publish a second snapshot, assert the memo is updated (not blindly replaced) and the `updated_at` advances.

### Actions (`tests/unit/lib/reviews/actions.test.ts`, extension)

- `publishReview()` returns success even when the learner throws.
- Memo UPSERT happens on successful learn, not on skip.

### E2E (`tests/e2e/performance-reports.spec.ts`)

Add one case: publish, navigate to settings, memo card is visible with non-empty content. Include a visual snapshot of the settings page covering the new card.

## Rollout

1. **Migration** adds `ai_originals` to `marketing_review_snapshots` and creates `marketing_review_style_memos` with RLS policies. Both nullable; no backfill — older snapshots simply don't contribute, and the memo bootstraps from the next publish.
2. Ship prompt integration gated on memo-present. Empty memo = current behavior, so this is a safe default.
3. Settings + editor UI in the same release (both trivial once the data model lands).
4. No feature flag. Scope is narrow, the empty-memo fallback is equivalent to today's behavior, and gating adds surface area without reducing risk.

## Out of scope for v1

- Memo versioning / history / rollback (single row; manual edit is the rollback mechanism).
- Multi-author learning (memo is per-org regardless of publisher).
- Structured-rule extraction or schema for learned preferences.
- Per-slide / per-block memo segmentation.
- Surfacing the memo on the preview, snapshot detail, or public share pages.
- Bumping the narrative generator from `claude-opus-4-5` to `claude-opus-4-7` (separate follow-up).

## Open follow-ups

- Upgrade the generator to `claude-opus-4-7` once the memo is live and we can A/B perceived quality.
- Consider surfacing a diff view ("what changed in the memo after Q2") if authors start wanting to audit learner behavior.
- If author edits to the memo frequently get overwritten by the learner, revisit the precedence rule (maybe `source='manual'` should lock the memo against auto-updates until explicitly unlocked).
