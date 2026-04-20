# Performance Reports — Phase 4: Slide Rendering Design

**Date:** 2026-04-20
**Status:** Approved
**Phase:** 4 of N (Performance Reports)

## Goal

Render the six AI-generated narrative blocks produced in Phase 3 as a presentation-style slide deck, viewable by internal admins (preview + snapshot) and by clients via a public share link. Add a minimal publish workflow that freezes the mutable draft into a versioned snapshot.

## Architecture

### Routes

| Route | Purpose | Data source |
|---|---|---|
| `/{orgId}/reports/performance/[id]` | Draft editor (existing) + Publish/Preview/Snapshots buttons | `marketing_review_drafts` |
| `/{orgId}/reports/performance/[id]/preview` | Full-viewport deck of current draft (admin/internal only) | `marketing_review_drafts` |
| `/{orgId}/reports/performance/[id]/snapshots` | List of published snapshots (version, date, share status) | `marketing_review_snapshots` |
| `/{orgId}/reports/performance/[id]/snapshots/[snapId]` | Authenticated view of a frozen snapshot | `marketing_review_snapshots` row |
| `/s/[token]` | Public share — renders the snapshot bound to the token | `shared_links.resource_id → marketing_review_snapshots` |

### Shared renderer

A single client component tree under `components/reviews/review-deck/` used by preview, snapshot detail, and public share routes. Guarantees that every viewing surface produces the same visual output.

### Publish workflow

Append-only versioning: every publish creates a new `marketing_review_snapshots` row with an incremented `version`. `marketing_reviews.latest_snapshot_id` tracks the newest. Share tokens bind to a specific snapshot, so recipients always see the version they were sent.

### Branding

Cover slide displays `organization.logo_url` when present. `organization.primary_color` applies to all slide headings via a CSS custom property on the deck root. Both fields fall back to defaults when null.

## Slide renderer component

### Location

```
components/reviews/review-deck/
  index.tsx              # <ReviewDeck> — orchestrator
  slide.tsx              # <Slide> — single-slide wrapper with layout
  cover-slide.tsx        # Cover layout (logo, name, quarter, subtitle)
  body-slide.tsx         # Generic body layout (heading + narrative)
  deck-controls.tsx      # Prev/next buttons + fullscreen button
  use-deck-navigation.ts # Keyboard handler + current-index state
```

### Props

```ts
interface ReviewDeckProps {
  organization: {
    name: string
    logo_url: string | null
    primary_color: string | null
  }
  quarter: string
  periodStart: string
  periodEnd: string
  narrative: NarrativeBlocks
  data: SnapshotData // passed for future phases, unused in Phase 4
}
```

### Slide composition

Fixed array of six slides:

1. **Cover** — org logo (centered, top), org name, "Quarterly Performance Review", quarter (e.g. "Q1 2026"), period (e.g. "Jan 1 – Mar 31, 2026"), AI-generated `cover_subtitle`.
2. **Google Analytics** — heading + `ga_summary` paragraph.
3. **LinkedIn** — heading + `linkedin_insights` paragraph.
4. **Initiatives** — heading + `initiatives` paragraph.
5. **Takeaways** — heading + `takeaways` paragraph (preserves plain-text `- ` bullet lines).
6. **Planning Ahead** — heading + `planning` paragraph.

If a narrative block is empty or missing, render a muted placeholder ("No narrative available for this section") rather than hiding the slide. Slide count stays predictable.

### Navigation

- `useDeckNavigation` hook owns `currentIndex` (0–5) and exposes `next()`, `prev()`, `goTo(i)`.
- Keyboard: `→` / `Space` / `PageDown` → next; `←` / `PageUp` → prev; `Home` / `End` jump to first/last.
- Slides transition with `transform: translateX(-currentIndex * 100%)` and a CSS transition.
- `deck-controls.tsx` provides minimal on-screen prev/next buttons in corners.

### Fullscreen

Small icon button in `deck-controls.tsx` (bottom-right) calls `element.requestFullscreen()` on the deck root. Escape exits natively.

### Theming

Root element sets `style={{ '--deck-accent': primary_color ?? 'var(--foreground)' }}`. Slide headings use `color: var(--deck-accent)`.

### Responsive

Deck fills container with `aspect-ratio: 16/9`. On small viewports it falls back to full-height. Narrative text uses fluid `clamp()` sizing.

## Publish workflow

### Database

New migration `20260420XXXXXX_marketing_review_snapshot_version.sql`:

- Add `version integer not null default 1` column to `marketing_review_snapshots`.
- Add unique constraint on `(review_id, version)`.

### Server action

`publishReview(reviewId)` in `lib/reviews/actions.ts`:

1. Authenticate: admin of the review's org, or internal user. Reject otherwise.
2. Load draft for the review. Return error if missing or if narrative is empty across all blocks.
3. Compute next version: `max(version) + 1` across existing snapshots for this review (or 1 if none).
4. Insert snapshot: `{ review_id, version, data: draft.data, narrative: draft.narrative, published_at: now(), published_by: userId }`.
5. Update `marketing_reviews.latest_snapshot_id = newSnapshotId`.
6. Log usage (`UsageFeature.MarketingReviews`, action `publish`).
7. Return `{ success: true, snapshotId, version }`.
8. `revalidatePath` on the review detail + snapshots list routes.

### Editor page additions

`[id]/page.tsx` header gains three buttons for admin/internal users: **Preview** (links to `./preview`), **Publish** (calls `publishReview`, toast on success), **Snapshots** (links to `./snapshots`). Non-admins see only Preview.

### Snapshots list page

`[id]/snapshots/page.tsx` — server component table with columns: Version, Published, Published by, Share status, Actions. Actions per row: **View** (→ `./[snapId]`), **Share** (opens `ShareModal` with `SharedResourceType.MarketingReview`).

### Snapshot detail page

`[id]/snapshots/[snapId]/page.tsx` — server component loads snapshot + organization, renders `<ReviewDeck>` in a minimal layout with breadcrumb back to the snapshots list.

### Public share

`app/s/[token]/client.tsx` line 96 already has `case SharedResourceType.MarketingReview:`. Wire it to load the snapshot via the share token and render `<ReviewDeck>` in the public layout (no Selo app chrome).

## Preview route

**Path:** `/{orgId}/reports/performance/[id]/preview`

**Access control:** Admin of the review's org or internal user. Non-admins redirect to the review detail page (not the public share — avoids leaking unpublished content).

**Behaviour:**

1. Authenticate via `getAuthUser` + `getUserRecord`; check `canEdit` the same way `[id]/page.tsx` does.
2. Load `marketing_reviews`, `marketing_review_drafts`, and `organizations`.
3. Empty-state if no draft exists, linking back to the editor.
4. Minimal layout (no app sidebar) with `<ReviewDeck>` filling the viewport.
5. Dismissible banner: "Preview of current draft — not yet published. [Publish] [Back to editor]", amber accent.
6. `export const dynamic = 'force-dynamic'` — always reads the current draft, no caching.

## Testing

### Unit tests

- `lib/reviews/actions.test.ts` — `publishReview`:
  - Rejects non-admin non-internal users
  - Returns error when no draft exists
  - Returns error when narrative is empty across all blocks
  - Computes next version correctly (first publish = v1, subsequent = max + 1)
  - Updates `latest_snapshot_id` on the review
  - Logs usage with `action: 'publish'`

- `components/reviews/review-deck/use-deck-navigation.test.ts`:
  - `next()` / `prev()` clamp at boundaries
  - Keyboard handler responds to Arrow/Space/PageDown/PageUp/Home/End
  - `goTo(i)` clamps out-of-range indices

- `components/reviews/review-deck/review-deck.test.tsx`:
  - Renders six slides for a full narrative
  - Shows muted placeholder when a block is empty
  - Applies `primary_color` to headings when provided
  - Falls back to default color when `primary_color` is null
  - Renders org logo when `logo_url` is set; omits image when null

### Integration tests

Skipped — `publishReview` coverage via unit tests with mocked Supabase client, matching the existing pattern for action tests.

### E2E tests

Extend `tests/e2e/performance-reports.spec.ts`:

- Admin edits a narrative block, clicks Preview, sees the deck with the edit
- Admin clicks Publish from preview, lands on snapshot detail
- Admin opens snapshots list, shares a snapshot, copies link, visits public `/s/[token]` in an unauthenticated context, sees the deck

### Visual snapshots

Extend `tests/e2e/visual.spec.ts`: one screenshot each for preview route, snapshot detail, and public share.

## Out of scope for Phase 4

- PDF export (print CSS or server-side render)
- Metric data on body slides (headline stats, mini metric grids) — planned as a later enhancement
- Auto-fullscreen on share open
- Thumbnail strip or jump-to-slide UI
- Analytics/view tracking for public share
- Snapshot comparison/diff
