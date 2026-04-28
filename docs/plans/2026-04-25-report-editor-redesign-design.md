# Performance Report Editor Redesign

## Goal

Replace the long-form scrollable editor with a slide-centric workspace, and add per-report slide visibility so authors can hide slides whose underlying data is missing (e.g. GA, LinkedIn) without deleting their narrative content.

## Why

- Current editor is a single tall column of textareas. Authors can't see which deck slide a field maps to without flipping to `/preview`.
- When a report has no GA or LinkedIn data, the corresponding deck slides still render with placeholder narrative — there's no way to suppress them per quarter without editing source code.
- The "Style Memo" and "Author Notes" cards eat vertical space at the top of every report and dilute focus from the slide content itself.

## Architecture

Two views replace the single editor page:

**View 1 — overview** (`/{orgId}/reports/performance/{id}`)
Header (full width, ← Back left-aligned, action buttons right-aligned) → Context for AI panel (full width) → row of 7 slide thumbnails (Cover + 6 body slides). Clicking a thumbnail navigates to View 2. Each non-Cover thumbnail has an eye toggle that flips its hidden state.

**View 2 — slide editor** (`/{orgId}/reports/performance/{id}/slides/{slideKey}`)
Header (← Slides + slide name + slide N of M + style-memo / Preview / Publish actions) → active slide rendered in the existing `<ReviewDeck>` shell with native DeckControls (top-right fullscreen, bottom-left prev, bottom-right next) → bottom tray (fixed, expandable/collapsible) holding the narrative textarea(s) for that slide. Prev/Next steps through every slide including hidden ones; hidden slides render at ~40% opacity in the editor with a "Hidden" badge so the author keeps spatial sense of the deck.

The brain-icon popover (style memo content) and Preview / Publish / Snapshots buttons live in the top-right of the header on both views.

## Data model

Add a single column to two tables:

```sql
-- marketing_review_drafts
ALTER TABLE marketing_review_drafts
  ADD COLUMN hidden_slides text[] NOT NULL DEFAULT '{}';

-- marketing_review_snapshots
ALTER TABLE marketing_review_snapshots
  ADD COLUMN hidden_slides text[] NOT NULL DEFAULT '{}';
```

`hidden_slides` stores narrative-block keys (`ga_summary`, `linkedin_insights`, `content_highlights`, `initiatives`, `takeaways`, `planning`). The cover slide is never hideable — `'cover_subtitle'` is rejected at the action layer. `publishReview` copies `draft.hidden_slides` into the snapshot row.

## Componentization principles

Every UI surface in this redesign is built from small, single-purpose components composed inside thin pages. Goals:

- A page file is mostly imports + layout — no inline JSX trees longer than ~30 lines.
- Each component does one thing and exposes the minimum prop surface needed (no leaky internals).
- Slide metadata lives in one registry; every consumer (thumbnail strip, deck builder, View 2 router) reads from it.
- Field-level editors are shared across slide types so new slides can compose them without copy-paste.
- Fixed positioning, autosave, popover trigger logic, etc. each get their own hook or wrapper rather than inlining into pages.

This keeps the "swap one slide kind for another" or "add a new slide type" cost small.

## Slide registry

`lib/reviews/slides/registry.ts` is the single source of truth.

```ts
export type SlideKey =
  | 'cover'
  | 'ga_summary'
  | 'linkedin_insights'
  | 'content_highlights'
  | 'initiatives'
  | 'takeaways'
  | 'planning'

export type SlideKind = 'cover' | 'ga' | 'linkedin' | 'content' | 'prose'

export interface SlideDefinition {
  key: SlideKey
  /** Narrative block key (`cover_subtitle` for cover, otherwise === key). */
  narrativeBlockKey: keyof NarrativeBlocks
  label: string
  icon: LucideIcon
  kind: SlideKind
  hideable: boolean
}

export const SLIDES: readonly SlideDefinition[] = [
  /* … */
]
export function getSlide(key: SlideKey): SlideDefinition
```

Consumers:

- `<ReviewDeck>` builds slides by mapping over `SLIDES`, dispatching on `kind` to a renderer.
- `<SlideThumbnailStrip>` maps `SLIDES` → `<SlideThumbnail>`.
- View 2's route validates `slideKey` against `SLIDES` and dispatches the tray editor by `kind`.
- Server actions validate `slideKey` and consult `hideable` before mutating `hidden_slides`.

## `<ReviewDeck>` becomes mode-aware

```ts
type DeckMode = 'editor' | 'presentation'
```

- `presentation` (default for snapshots, `/preview`, `/s/{token}`): filters out keys in `hiddenSlides`.
- `editor`: keeps every slide; wraps hidden ones in `<HiddenSlideOverlay>` (opacity-40 + "Hidden" badge).

Decomposition inside the deck folder (`components/reviews/review-deck/`):

- `index.tsx` — orchestrator only. Reads `SLIDES`, applies mode, returns `<DeckShell>` with native `<DeckControls>`.
- `slide-renderer.tsx` — pure dispatch from `SlideKind` → matching body component (existing `cover-slide`, `ga-body-slide`, `linkedin-body-slide`, `content-body-slide`, `body-slide`).
- `hidden-slide-overlay.tsx` — opacity wrapper + "Hidden" badge.
- Existing slide components (`cover-slide.tsx`, `body-slide.tsx`, etc.) stay; the auto-hide of `content_highlights` moves into the renderer's presentation-mode filter and is removed from `index.tsx`.

## View 1 — overview page

Page file (`app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx`) becomes a thin server component composing:

- `<ReportEditorHeader>` (full-width shell)
  - `<BackLink>` (← Back, left)
  - `<ReportTitle title quarter />`
  - `<ReportHeaderActions>`
    - `<StyleMemoButton>` (icon-only popover trigger)
      - `<StyleMemoPopover>` (existing `StyleMemoPreview` content rehoused)
    - `<PreviewButton href />`
    - `<PublishButton reviewId />`
    - `<SnapshotsButton href />`
- `<ContextForAiPanel>` (full-width; replaces `AuthorNotesEditor`'s card framing — same field, new chrome)
- `<SlideThumbnailStrip>` — server component, maps `SLIDES`
  - `<SlideThumbnail>` — labelled card
    - `<SlideIcon kind />`
    - `<SlideLabel label />`
    - `<HideSlideToggle reviewId slideKey hidden hideable />` (client; calls `setSlideVisibility`; Cover renders an inert `—`)
    - Wrapped in `<SlideThumbnailLink href={`…/slides/${key}`} />`

Each component lives in its own file under `components/reviews/editor/` (and re-exports a small barrel where helpful). The existing `NarrativeEditor` is removed from this page — its fields move to per-slide trays.

## View 2 — slide editor page

New route `app/(authenticated)/[orgId]/reports/performance/[id]/slides/[slideKey]/page.tsx`. Validates the key against `SLIDES` (404 otherwise), loads draft, then composes:

- `<ReportEditorHeader>` (same shell, different `<BackLink>` href and title slot — `<SlideTitle slideKey index total />`)
- `<SlideStage slideKey draft data hiddenSlides />`
  - Reuses `<ReviewDeck mode="editor" initialSlideKey={slideKey}>` so prev/next + fullscreen + opacity dimming are inherited for free.
- `<SlideTray>` (fixed bottom, expand/collapse behaviour)
  - `<TrayHandle expanded onToggle />`
  - `<TrayContent>` — dispatches on `SlideKind` to the appropriate editor:
    - `<CoverTrayEditor />`
    - `<GaTrayEditor />`
    - `<LinkedInTrayEditor />`
    - `<ContentTrayEditor />`
    - `<ProseTrayEditor />` (used by Initiatives / Takeaways / Planning)

Each tray editor composes from a small set of shared field components in `components/reviews/editor/fields/`:

- `<SubtitleField label limit value onChange />`
- `<BulletsField label limit value onChange />`
- `<GoingWellField />` and `<ToImproveField />` (thin wrappers over `<BulletsField>` with preset labels)
- `<ProseField label limit value onChange />`

All of these run autosave through a single shared hook `useNarrativeBlockAutosave(reviewId, blockKey)` so adding a new block later is one entry in the registry plus one editor composition.

Native `<DeckControls>` continue to handle fullscreen and prev/next. The tray hides via existing `:fullscreen` CSS.

## Server actions

In `app/(authenticated)/[orgId]/reports/performance/[id]/actions.ts`:

```ts
export async function setSlideVisibility(
  reviewId: string,
  slideKey: SlideKey,
  hidden: boolean
): Promise<{ ok: true } | { error: string }>
```

- Auth + org check via existing `withAuth` pattern.
- Rejects when `getSlide(slideKey).hideable === false` (covers Cover and any future always-shown slide).
- Updates `marketing_review_drafts.hidden_slides` (add/remove). Returns OK; client revalidates.

`publishReview` already copies most draft fields into the snapshot — extend its select+insert to include `hidden_slides`.

## Routes summary

| Route                                                      | Purpose                        | Mode                        |
| ---------------------------------------------------------- | ------------------------------ | --------------------------- |
| `/{orgId}/reports/performance/{id}`                        | View 1 — overview + thumbnails | edit                        |
| `/{orgId}/reports/performance/{id}/slides/{slideKey}`      | View 2 — slide editor          | edit                        |
| `/{orgId}/reports/performance/{id}/preview`                | Read-only full deck            | presentation, draft data    |
| `/{orgId}/reports/performance/{id}/snapshots/{snapshotId}` | Published snapshot             | presentation, snapshot data |
| `/s/{token}`                                               | Public share                   | presentation, snapshot data |

`/preview` stays so an author can see the full as-published deck without per-slide chrome. It now respects `hidden_slides`.

## Tests

- Unit: `setSlideVisibility` rejects `cover`, persists otherwise.
- Unit: `<ReviewDeck>` in `presentation` mode filters out hidden keys.
- Unit: `<ReviewDeck>` in `editor` mode keeps hidden slides but dims them.
- Integration: `publishReview` copies `hidden_slides` into the snapshot.
- E2E: hide a slide on View 1 → it dims in the strip; opening it shows the dim + badge in View 2; publishing produces a snapshot whose deck excludes that slide; `/preview` matches.
- Visual snapshot: View 1 (with one slide hidden) and View 2 (cover slide tray expanded).

## Out of scope

- Live mini-renders in thumbnails — labelled cards only for v1.
- Auto-detection of "no data" — purely manual toggle.
- Editing visibility on a published snapshot — snapshots remain immutable; change in draft and republish.
- Reordering slides — order stays fixed.

## Open questions

None — all decisions resolved during brainstorm:

- Manual toggle (not auto-detect)
- All 6 body slides hideable (not just data slides)
- 7 thumbnails (Cover included for navigation, eye-toggle suppressed)
- Hidden slides included in editor prev/next at low opacity; excluded from presentation
- Preview button kept as standalone read-only deck
- Slide grows when tray collapsed
