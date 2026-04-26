# Performance Report Editor Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the long-form scrollable performance-report editor with a slide-centric workspace (View 1 overview + View 2 per-slide editor) and add per-report slide visibility.

**Architecture:** Two routes replace the single editor page. A new slide registry (`lib/reviews/slides/registry.ts`) becomes the single source of truth that the deck, thumbnail strip, slide-editor router, and `setSlideVisibility` action all read from. `<ReviewDeck>` becomes mode-aware (`presentation` filters hidden slides; `editor` dims them with an overlay). View 2 reuses the existing deck for the slide stage — the per-slide tray below it is the only editor surface; native `<DeckControls>` keeps prev/next/fullscreen.

**Tech Stack:** Next.js 16 App Router + RSC, TypeScript, Supabase Postgres, Tailwind 4, shadcn/ui, Vitest + Testing Library, Playwright.

**Source design doc:** `docs/plans/2026-04-25-report-editor-redesign-design.md` (committed at `0c3d426`).

**Out of scope:** auto-detection of empty data, mini-renders inside thumbnails, snapshot-time visibility editing, slide reordering. See design doc § Out of scope.

---

## Conventions for every task

- TDD: write the failing test first, run it red, write the minimum code to pass it, run green, commit.
- Use Vitest + Testing Library for unit tests, Playwright for E2E + visuals.
- Server actions use the existing `authorizeAdminOrInternal` pattern from `lib/reviews/actions.ts:22`.
- Migrations are timestamped UTC. Use `2026042512XXXX` numbers in this plan as placeholders — replace each with `$(date -u +%Y%m%d%H%M%S)` at apply time so timestamps are monotonic and unique.
- Every slide component lives under `components/reviews/review-deck/` or `components/reviews/editor/`. New files single-purpose; pages stay thin.
- `data-testid` on every page heading, button, and stateful surface — see CLAUDE.md § E2E Testing Conventions.
- Commit format: `feat(reports):`, `fix(reports):`, `test(reports):`, `refactor(reports):` — match existing report commits in `git log`.

---

## Task 1: Add `hidden_slides` column to draft + snapshot tables

**Files:**

- Create: `supabase/migrations/2026042512XXXX_review_hidden_slides.sql`
- Test: `tests/integration/reviews/hidden-slides-column.test.ts`

**Step 1: Write the failing integration test**

```ts
// tests/integration/reviews/hidden-slides-column.test.ts
import { describe, test, expect, beforeAll } from 'vitest'
import { createServiceClient } from '@/lib/supabase/server'
import { seedOrgWithDraft } from '../helpers/reviews' // existing helper

describe('marketing_review_drafts.hidden_slides', () => {
  test('defaults to empty text[] and accepts narrative-block keys', async () => {
    const { reviewId } = await seedOrgWithDraft()
    const supabase = await createServiceClient()

    const { data: draft } = await supabase
      .from('marketing_review_drafts')
      .select('hidden_slides')
      .eq('review_id', reviewId)
      .single()
    expect(draft?.hidden_slides).toEqual([])

    const { error } = await supabase
      .from('marketing_review_drafts')
      .update({ hidden_slides: ['ga_summary'] })
      .eq('review_id', reviewId)
    expect(error).toBeNull()
  })

  test('marketing_review_snapshots.hidden_slides defaults to empty', async () => {
    const { snapshotId } = await seedOrgWithDraft({ withSnapshot: true })
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('marketing_review_snapshots')
      .select('hidden_slides')
      .eq('id', snapshotId)
      .single()
    expect(data?.hidden_slides).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `supabase db reset && npx vitest run tests/integration/reviews/hidden-slides-column.test.ts`
Expected: FAIL with column does not exist.

**Step 3: Write the migration**

```sql
-- supabase/migrations/2026042512XXXX_review_hidden_slides.sql
ALTER TABLE marketing_review_drafts
  ADD COLUMN hidden_slides text[] NOT NULL DEFAULT '{}';

ALTER TABLE marketing_review_snapshots
  ADD COLUMN hidden_slides text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN marketing_review_drafts.hidden_slides IS
  'Narrative-block keys (ga_summary, linkedin_insights, content_highlights, initiatives, takeaways, planning) the author has hidden from the deck. cover_subtitle is rejected at the action layer.';
COMMENT ON COLUMN marketing_review_snapshots.hidden_slides IS
  'Frozen copy of the draft hidden_slides at publish time.';
```

**Step 4: Apply, re-run test**

```bash
supabase db reset
npx vitest run tests/integration/reviews/hidden-slides-column.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add supabase/migrations/2026042512XXXX_review_hidden_slides.sql tests/integration/reviews/hidden-slides-column.test.ts
git commit -m "feat(reports): add hidden_slides column to draft and snapshot"
```

---

## Task 2: Slide registry — single source of truth

**Files:**

- Create: `lib/reviews/slides/registry.ts`
- Test: `tests/unit/lib/reviews/slides/registry.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, test, expect } from 'vitest'
import { SLIDES, getSlide, isSlideKey } from '@/lib/reviews/slides/registry'

describe('slide registry', () => {
  test('exposes 7 slides in deck order: cover, ga, linkedin, content, initiatives, takeaways, planning', () => {
    expect(SLIDES.map((s) => s.key)).toEqual([
      'cover',
      'ga_summary',
      'linkedin_insights',
      'content_highlights',
      'initiatives',
      'takeaways',
      'planning',
    ])
  })

  test('cover slide is not hideable', () => {
    expect(getSlide('cover').hideable).toBe(false)
  })

  test('every body slide is hideable', () => {
    const body = SLIDES.filter((s) => s.key !== 'cover')
    expect(body.every((s) => s.hideable)).toBe(true)
  })

  test('cover narrativeBlockKey is cover_subtitle, body slides match their key', () => {
    expect(getSlide('cover').narrativeBlockKey).toBe('cover_subtitle')
    expect(getSlide('ga_summary').narrativeBlockKey).toBe('ga_summary')
    expect(getSlide('content_highlights').narrativeBlockKey).toBe('content_highlights')
  })

  test('isSlideKey accepts known keys, rejects unknown', () => {
    expect(isSlideKey('ga_summary')).toBe(true)
    expect(isSlideKey('not_a_slide')).toBe(false)
  })

  test('getSlide throws on unknown key', () => {
    expect(() => getSlide('not_a_slide' as unknown as 'cover')).toThrow()
  })
})
```

**Step 2: Run — fail with module not found.**

**Step 3: Write the registry**

```ts
// lib/reviews/slides/registry.ts
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  BarChart3,
  Linkedin,
  Sparkles,
  Rocket,
  Lightbulb,
  Calendar,
} from 'lucide-react'
import type { NarrativeBlocks } from '@/lib/reviews/types'

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
  narrativeBlockKey: keyof NarrativeBlocks
  label: string
  icon: LucideIcon
  kind: SlideKind
  hideable: boolean
}

export const SLIDES: readonly SlideDefinition[] = [
  {
    key: 'cover',
    narrativeBlockKey: 'cover_subtitle',
    label: 'Cover',
    icon: LayoutDashboard,
    kind: 'cover',
    hideable: false,
  },
  {
    key: 'ga_summary',
    narrativeBlockKey: 'ga_summary',
    label: 'Google Analytics',
    icon: BarChart3,
    kind: 'ga',
    hideable: true,
  },
  {
    key: 'linkedin_insights',
    narrativeBlockKey: 'linkedin_insights',
    label: 'LinkedIn',
    icon: Linkedin,
    kind: 'linkedin',
    hideable: true,
  },
  {
    key: 'content_highlights',
    narrativeBlockKey: 'content_highlights',
    label: 'What Resonated',
    icon: Sparkles,
    kind: 'content',
    hideable: true,
  },
  {
    key: 'initiatives',
    narrativeBlockKey: 'initiatives',
    label: 'Initiatives',
    icon: Rocket,
    kind: 'prose',
    hideable: true,
  },
  {
    key: 'takeaways',
    narrativeBlockKey: 'takeaways',
    label: 'Takeaways',
    icon: Lightbulb,
    kind: 'prose',
    hideable: true,
  },
  {
    key: 'planning',
    narrativeBlockKey: 'planning',
    label: 'Planning Ahead',
    icon: Calendar,
    kind: 'prose',
    hideable: true,
  },
] as const

export function isSlideKey(value: string): value is SlideKey {
  return SLIDES.some((s) => s.key === value)
}

export function getSlide(key: SlideKey): SlideDefinition {
  const found = SLIDES.find((s) => s.key === key)
  if (!found) throw new Error(`Unknown slide key: ${key}`)
  return found
}
```

**Step 4: Run — green.**

**Step 5: Commit**

```bash
git add lib/reviews/slides/registry.ts tests/unit/lib/reviews/slides/registry.test.ts
git commit -m "feat(reports): add slide registry as single source of truth"
```

---

## Task 3: Add `setSlideVisibility` server action

**Files:**

- Modify: `lib/reviews/actions.ts` (append new export, do not refactor existing)
- Test: `tests/integration/reviews/set-slide-visibility.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, test, expect } from 'vitest'
import { setSlideVisibility } from '@/lib/reviews/actions'
import { createServiceClient } from '@/lib/supabase/server'
import { seedOrgWithDraftAsAdmin } from '../helpers/reviews'

describe('setSlideVisibility', () => {
  test('hides a body slide and persists to draft', async () => {
    const { reviewId } = await seedOrgWithDraftAsAdmin()
    const result = await setSlideVisibility(reviewId, 'ga_summary', true)
    expect(result).toEqual({ success: true })

    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('marketing_review_drafts')
      .select('hidden_slides')
      .eq('review_id', reviewId)
      .single()
    expect(data?.hidden_slides).toEqual(['ga_summary'])
  })

  test('un-hides a slide by removing it from the array', async () => {
    const { reviewId } = await seedOrgWithDraftAsAdmin({ hiddenSlides: ['ga_summary'] })
    await setSlideVisibility(reviewId, 'ga_summary', false)
    const supabase = await createServiceClient()
    const { data } = await supabase
      .from('marketing_review_drafts')
      .select('hidden_slides')
      .eq('review_id', reviewId)
      .single()
    expect(data?.hidden_slides).toEqual([])
  })

  test('rejects cover slide', async () => {
    const { reviewId } = await seedOrgWithDraftAsAdmin()
    const result = await setSlideVisibility(reviewId, 'cover', true)
    expect(result).toEqual({ success: false, error: expect.stringMatching(/cover/i) })
  })

  test('rejects unknown slide keys', async () => {
    const { reviewId } = await seedOrgWithDraftAsAdmin()
    const result = await setSlideVisibility(reviewId, 'not_a_slide' as never, true)
    expect(result.success).toBe(false)
  })

  test('rejects non-admin users', async () => {
    const { reviewId } = await seedOrgWithDraftAsTeamMember()
    const result = await setSlideVisibility(reviewId, 'ga_summary', true)
    expect(result).toEqual({ success: false, error: expect.stringMatching(/permission/i) })
  })
})
```

**Step 2: Run — fail (export missing).**

**Step 3: Write the action — append to `lib/reviews/actions.ts`**

```ts
import { isSlideKey, getSlide, type SlideKey } from '@/lib/reviews/slides/registry'

export async function setSlideVisibility(
  reviewId: string,
  slideKey: SlideKey,
  hidden: boolean
): Promise<ActionOk | ActionErr> {
  if (!isSlideKey(slideKey)) {
    return { success: false, error: `Unknown slide key: ${slideKey}` }
  }
  if (!getSlide(slideKey).hideable) {
    return { success: false, error: 'Cover slide cannot be hidden' }
  }

  const review = await loadReviewForAuth(reviewId)
  if (!review) return { success: false, error: 'Review not found' }
  const auth = await authorizeAdminOrInternal(review.organization_id)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data: draft, error: loadError } = await supabase
    .from('marketing_review_drafts')
    .select('hidden_slides')
    .eq('review_id', reviewId)
    .single()
  if (loadError || !draft) return { success: false, error: loadError?.message ?? 'Draft not found' }

  const current = ((draft.hidden_slides as string[]) ?? []).filter(isSlideKey)
  const next = hidden
    ? Array.from(new Set([...current, slideKey]))
    : current.filter((k) => k !== slideKey)

  const { error } = await supabase
    .from('marketing_review_drafts')
    .update({ hidden_slides: next, updated_at: new Date().toISOString() })
    .eq('review_id', reviewId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/${review.organization_id}/reports/performance/${reviewId}`)
  revalidatePath(`/${review.organization_id}/reports/performance/${reviewId}/slides/${slideKey}`)
  return { success: true }
}
```

**Step 4: Run — green.**

**Step 5: Commit**

```bash
git add lib/reviews/actions.ts tests/integration/reviews/set-slide-visibility.test.ts
git commit -m "feat(reports): add setSlideVisibility server action"
```

---

## Task 4: Extend `publishReview` to copy `hidden_slides` into snapshot

**Files:**

- Modify: `lib/reviews/actions.ts:291-378` (extend select + insert)
- Test: `tests/integration/reviews/publish-review-hidden-slides.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, test, expect } from 'vitest'
import { publishReview } from '@/lib/reviews/actions'
import { seedOrgWithDraftAsAdmin } from '../helpers/reviews'
import { createServiceClient } from '@/lib/supabase/server'

describe('publishReview hidden_slides propagation', () => {
  test('copies draft.hidden_slides into the snapshot row', async () => {
    const { reviewId } = await seedOrgWithDraftAsAdmin({
      hiddenSlides: ['ga_summary', 'planning'],
      narrative: { ga_summary: 'x' },
    })
    const r = await publishReview(reviewId)
    expect(r.success).toBe(true)

    const supabase = await createServiceClient()
    const { data: snap } = await supabase
      .from('marketing_review_snapshots')
      .select('hidden_slides')
      .eq('id', r.success ? r.snapshotId : '')
      .single()
    expect(snap?.hidden_slides?.sort()).toEqual(['ga_summary', 'planning'])
  })

  test('snapshot defaults to empty when draft has no hidden slides', async () => {
    const { reviewId } = await seedOrgWithDraftAsAdmin({ narrative: { ga_summary: 'x' } })
    const r = await publishReview(reviewId)
    const supabase = await createServiceClient()
    const { data: snap } = await supabase
      .from('marketing_review_snapshots')
      .select('hidden_slides')
      .eq('id', r.success ? r.snapshotId : '')
      .single()
    expect(snap?.hidden_slides).toEqual([])
  })
})
```

**Step 2: Run — fail (column not copied).**

**Step 3: Modify `publishReview`:**

- Add `hidden_slides` to the draft select: `.select('data, narrative, author_notes, ai_originals, hidden_slides')`
- Add to insert: `hidden_slides: (draft.hidden_slides as string[] | null) ?? []`

**Step 4: Run — green.**

**Step 5: Commit**

```bash
git add lib/reviews/actions.ts tests/integration/reviews/publish-review-hidden-slides.test.ts
git commit -m "feat(reports): copy hidden_slides into published snapshot"
```

---

## Task 5: Add `mode` + `hiddenSlides` + `initialSlideKey` props to `<ReviewDeck>`

**Files:**

- Modify: `components/reviews/review-deck/index.tsx`
- Modify: `components/deck/use-deck-navigation.ts` (accept `initialIndex`)
- Test: `tests/unit/components/reviews/review-deck/review-deck-modes.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReviewDeck } from '@/components/reviews/review-deck'
import { sampleSnapshotData, sampleNarrative, sampleOrg } from '@/tests/helpers/reviews-fixtures'

describe('ReviewDeck mode behaviour', () => {
  test('presentation mode (default) filters out keys in hiddenSlides', () => {
    render(
      <ReviewDeck
        organization={sampleOrg}
        quarter="Q1 2026"
        periodStart="2026-01-01"
        periodEnd="2026-03-31"
        narrative={sampleNarrative}
        data={sampleSnapshotData}
        hiddenSlides={['ga_summary']}
      />
    )
    expect(screen.queryByLabelText(/Google Analytics/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/LinkedIn/)).toBeInTheDocument()
  })

  test('editor mode keeps hidden slides but renders Hidden badge', () => {
    render(
      <ReviewDeck
        organization={sampleOrg}
        quarter="Q1 2026"
        periodStart="2026-01-01"
        periodEnd="2026-03-31"
        narrative={sampleNarrative}
        data={sampleSnapshotData}
        hiddenSlides={['ga_summary']}
        mode="editor"
      />
    )
    const ga = screen.getByLabelText(/Google Analytics/)
    expect(ga).toBeInTheDocument()
    expect(within(ga).getByText(/Hidden/i)).toBeInTheDocument()
  })

  test('initialSlideKey starts the deck on the requested slide', () => {
    render(
      <ReviewDeck
        organization={sampleOrg}
        quarter="Q1 2026"
        periodStart="2026-01-01"
        periodEnd="2026-03-31"
        narrative={sampleNarrative}
        data={sampleSnapshotData}
        mode="editor"
        initialSlideKey="initiatives"
      />
    )
    const track = screen.getByTestId('review-deck-track')
    // index of 'initiatives' in SLIDES is 4 (cover, ga, linkedin, content, initiatives)
    expect(track.getAttribute('data-current-index')).toBe('4')
  })

  test('content_highlights is auto-hidden in presentation mode when posts is empty', () => {
    const dataNoPosts = {
      ...sampleSnapshotData,
      linkedin: { ...sampleSnapshotData.linkedin, top_posts: [] },
    }
    render(
      <ReviewDeck
        organization={sampleOrg}
        quarter="Q1 2026"
        periodStart="2026-01-01"
        periodEnd="2026-03-31"
        narrative={sampleNarrative}
        data={dataNoPosts}
      />
    )
    expect(screen.queryByLabelText(/What Resonated/)).not.toBeInTheDocument()
  })

  test('content_highlights is shown in editor mode even when posts is empty', () => {
    const dataNoPosts = {
      ...sampleSnapshotData,
      linkedin: { ...sampleSnapshotData.linkedin, top_posts: [] },
    }
    render(
      <ReviewDeck
        organization={sampleOrg}
        quarter="Q1 2026"
        periodStart="2026-01-01"
        periodEnd="2026-03-31"
        narrative={sampleNarrative}
        data={dataNoPosts}
        mode="editor"
      />
    )
    expect(screen.getByLabelText(/What Resonated/)).toBeInTheDocument()
  })
})
```

**Step 2: Run — fail.**

**Step 3: Implement.**

- Add `tests/helpers/reviews-fixtures.ts` exporting `sampleOrg`, `sampleNarrative`, `sampleSnapshotData` (use realistic GA + LinkedIn data; reuse from existing tests if available).
- Add to `ReviewDeckProps`:

  ```ts
  export type DeckMode = 'editor' | 'presentation'
  hiddenSlides?: readonly string[]
  mode?: DeckMode // default 'presentation'
  initialSlideKey?: SlideKey
  ```

- Drive slide construction off `SLIDES` from the registry; dispatch by `kind` to existing slide components (`CoverSlide` / `GaBodySlide` / `LinkedInBodySlide` / `ContentBodySlide` / `BodySlide`).
- Filter logic:
  - `mode === 'presentation'`: drop slides where `key in hiddenSlides`; drop `content_highlights` when `posts.length === 0`.
  - `mode === 'editor'`: keep every slide; wrap render in `<HiddenSlideOverlay>` when `key in hiddenSlides`.
- Update `useDeckNavigation(slides.length, initialIndex)` — make `initialIndex` optional with default 0; resolve from `initialSlideKey` via `slides.findIndex`.

**Step 4: Run — green.**

**Step 5: Commit**

```bash
git add components/reviews/review-deck/index.tsx components/deck/use-deck-navigation.ts \
  tests/unit/components/reviews/review-deck/review-deck-modes.test.tsx \
  tests/helpers/reviews-fixtures.ts
git commit -m "feat(reports): make ReviewDeck mode-aware with hiddenSlides + initialSlideKey"
```

---

## Task 6: Decompose `<ReviewDeck>` into renderer + overlay

**Files:**

- Create: `components/reviews/review-deck/slide-renderer.tsx`
- Create: `components/reviews/review-deck/hidden-slide-overlay.tsx`
- Modify: `components/reviews/review-deck/index.tsx` — orchestrator only
- Test: `tests/unit/components/reviews/review-deck/hidden-slide-overlay.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HiddenSlideOverlay } from '@/components/reviews/review-deck/hidden-slide-overlay'

describe('HiddenSlideOverlay', () => {
  test('renders children with reduced opacity and a "Hidden" badge', () => {
    render(
      <HiddenSlideOverlay>
        <div data-testid="child">Slide</div>
      </HiddenSlideOverlay>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Hidden')).toBeInTheDocument()
    expect(screen.getByTestId('hidden-slide-overlay')).toHaveClass('opacity-40')
  })
})
```

**Step 2: Run — fail.**

**Step 3: Write `<HiddenSlideOverlay>`** — wraps children in a `relative opacity-40` div with a top-right shadcn `Badge` showing "Hidden". Add `data-testid="hidden-slide-overlay"`.

**Step 4: Extract `<SlideRenderer>`** — pure dispatch. Props: `{ slide: SlideDefinition, narrative: NarrativeBlocks, data: SnapshotData, mode: 'screen' | 'print' }`. Returns the right body component for the slide's `kind`. Keeps the existing print/screen toggle for the GA slide unchanged.

**Step 5: Trim `index.tsx`** — replace the inline switch with `<SlideRenderer>`. The mode-aware filter from Task 5 stays in `index.tsx` but slide construction collapses to a `SLIDES.map(...)`.

**Step 6: Run all deck tests** — must still pass.

**Step 7: Commit**

```bash
git add components/reviews/review-deck/slide-renderer.tsx \
  components/reviews/review-deck/hidden-slide-overlay.tsx \
  components/reviews/review-deck/index.tsx \
  tests/unit/components/reviews/review-deck/hidden-slide-overlay.test.tsx
git commit -m "refactor(reports): extract SlideRenderer and HiddenSlideOverlay from ReviewDeck"
```

---

## Task 7: `useNarrativeBlockAutosave` shared hook

**Files:**

- Create: `components/reviews/editor/use-narrative-block-autosave.ts`
- Test: `tests/unit/components/reviews/editor/use-narrative-block-autosave.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, test, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNarrativeBlockAutosave } from '@/components/reviews/editor/use-narrative-block-autosave'

vi.useFakeTimers()
vi.mock('@/lib/reviews/actions', () => ({
  updateNarrative: vi.fn().mockResolvedValue({ success: true }),
}))

describe('useNarrativeBlockAutosave', () => {
  test('debounces updateNarrative by 1.5s and reports status transitions', async () => {
    const { updateNarrative } = await import('@/lib/reviews/actions')
    const { result } = renderHook(() => useNarrativeBlockAutosave('rev-1', 'ga_summary', 'initial'))

    expect(result.current.status).toBe('idle')

    act(() => result.current.setValue('next'))
    expect(result.current.status).toBe('saving')
    expect(updateNarrative).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(updateNarrative).toHaveBeenCalledWith('rev-1', 'ga_summary', 'next')
    expect(result.current.status).toBe('saved')
  })

  test('reports error when action returns success: false', async () => {
    const { updateNarrative } = await import('@/lib/reviews/actions')
    ;(updateNarrative as any).mockResolvedValueOnce({ success: false, error: 'boom' })
    const { result } = renderHook(() => useNarrativeBlockAutosave('rev-1', 'ga_summary', ''))
    act(() => result.current.setValue('x'))
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('boom')
  })
})
```

**Step 2: Run — fail.**

**Step 3: Implement.** Hook returns `{ value, setValue, status: 'idle'|'saving'|'saved'|'error', errorMessage }`. Internals match the existing pattern in `narrative-editor.tsx:1-179` (1.5s debounce via `useRef<NodeJS.Timeout>`, cleanup on unmount).

**Step 4: Commit**

```bash
git add components/reviews/editor/use-narrative-block-autosave.ts \
  tests/unit/components/reviews/editor/use-narrative-block-autosave.test.tsx
git commit -m "feat(reports): extract useNarrativeBlockAutosave hook"
```

---

## Task 8: Shared field components — `SubtitleField`, `BulletsField`, `ProseField`

**Files:**

- Create: `components/reviews/editor/fields/subtitle-field.tsx`
- Create: `components/reviews/editor/fields/bullets-field.tsx`
- Create: `components/reviews/editor/fields/prose-field.tsx`
- Test: `tests/unit/components/reviews/editor/fields.test.tsx`

**Step 1: Write the failing tests** — assert each field renders label, hint, textarea, save-status indicator, and propagates `value` + `onChange`. Assert the `limit` prop renders a counter (e.g. "120 / 240"). Don't test debounce here (Task 7 covers that).

**Step 2: Run — fail.**

**Step 3: Implement.** Each field is a pure presentational component (no autosave). Trays own the hook from Task 7 and pass `value` / `onChange` / `status` to the field.

- `SubtitleField` — single-line `<input>`-like textarea (rows=2), inline counter.
- `BulletsField` — multi-line textarea with bullet hint placeholder.
- `ProseField` — multi-line textarea, larger rows.

**Step 4: Commit**

```bash
git add components/reviews/editor/fields/ tests/unit/components/reviews/editor/fields.test.tsx
git commit -m "feat(reports): add shared narrative field components"
```

---

## Task 9: Tray editors — Cover, GA, LinkedIn, Content, Prose

**Files:**

- Create: `components/reviews/editor/trays/cover-tray-editor.tsx`
- Create: `components/reviews/editor/trays/ga-tray-editor.tsx`
- Create: `components/reviews/editor/trays/linkedin-tray-editor.tsx`
- Create: `components/reviews/editor/trays/content-tray-editor.tsx`
- Create: `components/reviews/editor/trays/prose-tray-editor.tsx`
- Test: `tests/unit/components/reviews/editor/trays.test.tsx`

**Step 1: Write the failing tests**

- `CoverTrayEditor` calls autosave on `cover_subtitle`.
- `GaTrayEditor` / `LinkedInTrayEditor` / `ContentTrayEditor` each call autosave on their respective narrative block key.
- `ProseTrayEditor` accepts a `slideKey` prop (`initiatives | takeaways | planning`) and uses it for autosave.

**Step 2: Run — fail.**

**Step 3: Implement.** Each tray composes one or more shared field components from Task 8 wired to `useNarrativeBlockAutosave` from Task 7. Cover/GA/LinkedIn/Content/Prose all collapse to ~15 lines each.

**Step 4: Commit**

```bash
git add components/reviews/editor/trays/ tests/unit/components/reviews/editor/trays.test.tsx
git commit -m "feat(reports): add tray editors per slide kind"
```

---

## Task 10: `<SlideTray>` shell with expand/collapse

**Files:**

- Create: `components/reviews/editor/slide-tray.tsx`
- Create: `components/reviews/editor/tray-handle.tsx`
- Test: `tests/unit/components/reviews/editor/slide-tray.test.tsx`

**Step 1: Write the failing test**

```tsx
test('toggling the handle collapses and expands the tray content', async () => {
  render(
    <SlideTray defaultExpanded>
      <div data-testid="tray-body">body</div>
    </SlideTray>
  )
  expect(screen.getByTestId('tray-body')).toBeVisible()
  await userEvent.click(screen.getByTestId('tray-handle'))
  expect(screen.queryByTestId('tray-body')).not.toBeVisible()
})

test('hides on :fullscreen via CSS class hook', () => {
  const { container } = render(
    <SlideTray>
      <div />
    </SlideTray>
  )
  expect(container.firstChild).toHaveClass('fullscreen:hidden')
})
```

**Step 2: Run — fail.**

**Step 3: Implement.** Fixed-bottom `div` that holds tray content. `TrayHandle` is the chevron button. Add a Tailwind hook so `:fullscreen` ancestor hides the tray (mirror existing `.print-only` / `print:hidden` pattern from `index.tsx:236`).

**Step 4: Commit**

```bash
git add components/reviews/editor/slide-tray.tsx components/reviews/editor/tray-handle.tsx \
  tests/unit/components/reviews/editor/slide-tray.test.tsx
git commit -m "feat(reports): add SlideTray with expand/collapse"
```

---

## Task 11: View 1 — header components

**Files:**

- Create: `components/reviews/editor/report-editor-header.tsx`
- Create: `components/reviews/editor/back-link.tsx`
- Create: `components/reviews/editor/report-title.tsx`
- Create: `components/reviews/editor/report-header-actions.tsx`
- Test: `tests/unit/components/reviews/editor/report-editor-header.test.tsx`

**Step 1: Write the failing test** — assert `<BackLink>` renders a link with the supplied `href` and `← Back` text; `<ReportTitle>` renders title + quarter; `<ReportHeaderActions>` slot is on the right.

**Step 2: Run — fail.**

**Step 3: Implement.** `<ReportEditorHeader>` is a flex shell — back link left, title slot centre, action slot right. `<BackLink>` renders an `<a>` with `data-testid="report-editor-back-link"`. Headers are server components except `<ReportHeaderActions>` (which holds client buttons in Tasks 12-13).

**Step 4: Commit**

```bash
git add components/reviews/editor/report-editor-header.tsx \
  components/reviews/editor/back-link.tsx \
  components/reviews/editor/report-title.tsx \
  components/reviews/editor/report-header-actions.tsx \
  tests/unit/components/reviews/editor/report-editor-header.test.tsx
git commit -m "feat(reports): add ReportEditorHeader and slot components"
```

---

## Task 12: Style memo button + popover

**Files:**

- Create: `components/reviews/editor/style-memo-button.tsx`
- Create: `components/reviews/editor/style-memo-popover.tsx`
- Test: `tests/unit/components/reviews/editor/style-memo-button.test.tsx`

**Step 1: Write the failing test** — clicking the brain icon button opens the popover with the same memo content currently shown in `style-memo-preview.tsx` (read-only, last-updated label, link to settings).

**Step 2: Run — fail.**

**Step 3: Implement.** Use shadcn `<Popover>`. Reuse the rendering body from `app/(authenticated)/[orgId]/reports/performance/[id]/style-memo-preview.tsx` (extract a pure render helper if needed).

**Step 4: Commit**

```bash
git add components/reviews/editor/style-memo-button.tsx \
  components/reviews/editor/style-memo-popover.tsx \
  tests/unit/components/reviews/editor/style-memo-button.test.tsx
git commit -m "feat(reports): rehouse style memo as header popover"
```

---

## Task 13: Preview / Publish / Snapshots buttons

**Files:**

- Create: `components/reviews/editor/preview-button.tsx`
- Create: `components/reviews/editor/publish-button.tsx`
- Create: `components/reviews/editor/snapshots-button.tsx`
- Test: existing publish-button tests cover behaviour; assert each button renders with correct `href` / action wiring

**Step 1.** Each is a thin wrapper around the existing button used today in `editor-header.tsx`. `<PublishButton>` calls `publishReview` (already exists). `<PreviewButton>` is a `<Link href>` and `<SnapshotsButton>` likewise.

**Step 2.** Assert `data-testid="report-preview-button"`, `report-publish-button`, `report-snapshots-button` for E2E.

**Step 3: Commit**

```bash
git add components/reviews/editor/preview-button.tsx \
  components/reviews/editor/publish-button.tsx \
  components/reviews/editor/snapshots-button.tsx \
  tests/unit/components/reviews/editor/...
git commit -m "feat(reports): add preview, publish, snapshots header buttons"
```

---

## Task 14: `<ContextForAiPanel>` (replaces `<AuthorNotesEditor>` chrome)

**Files:**

- Create: `components/reviews/editor/context-for-ai-panel.tsx`
- Test: `tests/unit/components/reviews/editor/context-for-ai-panel.test.tsx`

**Step 1: Write the failing test** — assert it renders a heading "Context for AI", a textarea bound to `author_notes`, and autosaves through `updateAuthorNotes`. Reuse the existing autosave logic from `author-notes-editor.tsx` (extract the hook into `use-author-notes-autosave.ts` first if helpful).

**Step 2: Run — fail.**

**Step 3: Implement.** Same field as today, just no card framing — full-width panel sitting between header and thumbnail strip.

**Step 4: Commit**

```bash
git add components/reviews/editor/context-for-ai-panel.tsx \
  tests/unit/components/reviews/editor/context-for-ai-panel.test.tsx
git commit -m "feat(reports): add ContextForAiPanel replacing AuthorNotes card"
```

---

## Task 15: `<HideSlideToggle>` client component

**Files:**

- Create: `components/reviews/editor/hide-slide-toggle.tsx`
- Test: `tests/unit/components/reviews/editor/hide-slide-toggle.test.tsx`

**Step 1: Write the failing test**

```tsx
test('clicking the toggle calls setSlideVisibility with the inverse hidden state', async () => {
  const setSlide = vi.fn().mockResolvedValue({ success: true })
  vi.doMock('@/lib/reviews/actions', () => ({ setSlideVisibility: setSlide }))
  render(<HideSlideToggle reviewId="r1" slideKey="ga_summary" hidden={false} hideable={true} />)
  await userEvent.click(screen.getByRole('button', { name: /hide ga_summary/i }))
  expect(setSlide).toHaveBeenCalledWith('r1', 'ga_summary', true)
})

test('non-hideable slides render an inert dash', () => {
  render(<HideSlideToggle reviewId="r1" slideKey="cover" hidden={false} hideable={false} />)
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText('—')).toBeInTheDocument()
})
```

**Step 2: Run — fail.**

**Step 3: Implement.** Eye / Eye-Off icon button. On click: optimistic flip (useTransition), call `setSlideVisibility`. Surface error in a toast (use existing toast helper).

**Step 4: Commit**

```bash
git add components/reviews/editor/hide-slide-toggle.tsx \
  tests/unit/components/reviews/editor/hide-slide-toggle.test.tsx
git commit -m "feat(reports): add HideSlideToggle component"
```

---

## Task 16: `<SlideThumbnail>` + `<SlideThumbnailLink>` + `<SlideIcon>`

**Files:**

- Create: `components/reviews/editor/slide-thumbnail.tsx`
- Create: `components/reviews/editor/slide-thumbnail-link.tsx`
- Create: `components/reviews/editor/slide-icon.tsx`
- Test: `tests/unit/components/reviews/editor/slide-thumbnail.test.tsx`

**Step 1: Write the failing test**

- Renders the slide's `label` and `icon`.
- Clicking the card navigates to `/{orgId}/reports/performance/{id}/slides/{key}` (assert link `href`, no router mock needed).
- The `<HideSlideToggle>` from Task 15 lives inside the card and is keyboard-focusable independently — clicking it does NOT navigate.
- When `hidden`, the card renders dimmed (assert reduced opacity class).

**Step 2: Run — fail.**

**Step 3: Implement.** `<SlideThumbnailLink>` is the outer `<Link>`; `<SlideThumbnail>` is the labelled card; `<SlideIcon>` resolves the icon by `kind` from the registry. Stop click propagation on the toggle so navigation doesn't fire when toggling visibility.

**Step 4: Commit**

```bash
git add components/reviews/editor/slide-thumbnail.tsx \
  components/reviews/editor/slide-thumbnail-link.tsx \
  components/reviews/editor/slide-icon.tsx \
  tests/unit/components/reviews/editor/slide-thumbnail.test.tsx
git commit -m "feat(reports): add SlideThumbnail and supporting components"
```

---

## Task 17: `<SlideThumbnailStrip>` — server component

**Files:**

- Create: `components/reviews/editor/slide-thumbnail-strip.tsx`
- Test: `tests/unit/components/reviews/editor/slide-thumbnail-strip.test.tsx`

**Step 1: Write the failing test**

```tsx
test('renders 7 thumbnails in registry order', () => {
  render(<SlideThumbnailStrip orgId="o1" reviewId="r1" hiddenSlides={[]} />)
  const cards = screen.getAllByTestId(/slide-thumbnail-/)
  expect(cards).toHaveLength(7)
  expect(cards[0]).toHaveAttribute('data-testid', 'slide-thumbnail-cover')
  expect(cards[6]).toHaveAttribute('data-testid', 'slide-thumbnail-planning')
})

test('marks hidden slides with data-hidden=true', () => {
  render(<SlideThumbnailStrip orgId="o1" reviewId="r1" hiddenSlides={['ga_summary']} />)
  expect(screen.getByTestId('slide-thumbnail-ga_summary')).toHaveAttribute('data-hidden', 'true')
})
```

**Step 2: Run — fail.**

**Step 3: Implement.** Maps `SLIDES` from the registry → `<SlideThumbnailLink>` wrapping `<SlideThumbnail>`. RSC; client-island only the `<HideSlideToggle>` inside.

**Step 4: Commit**

```bash
git add components/reviews/editor/slide-thumbnail-strip.tsx \
  tests/unit/components/reviews/editor/slide-thumbnail-strip.test.tsx
git commit -m "feat(reports): add SlideThumbnailStrip server component"
```

---

## Task 18: View 1 page — recompose `[id]/page.tsx`

**Files:**

- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx`
- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/editor-header.tsx` — delete (replaced)
- Test: `tests/e2e/reports-editor-overview.spec.ts`

**Step 1: Update the page**

Composition:

```tsx
<ReportEditorHeader>
  <BackLink href={`/${orgId}/reports/performance`} label="Back" />
  <ReportTitle title={review.title} quarter={review.quarter} />
  <ReportHeaderActions>
    <StyleMemoButton orgId={orgId} memo={memo} updatedAt={memoUpdatedAt} />
    <PreviewButton href={`/${orgId}/reports/performance/${id}/preview`} />
    <SnapshotsButton href={`/${orgId}/reports/performance/${id}/snapshots`} />
    <PublishButton reviewId={id} />
  </ReportHeaderActions>
</ReportEditorHeader>

<ContextForAiPanel reviewId={id} initialNotes={draft.author_notes ?? ''} canEdit={canEdit} />

<SlideThumbnailStrip
  orgId={orgId}
  reviewId={id}
  hiddenSlides={draft.hidden_slides as SlideKey[]}
/>
```

Remove the `<NarrativeEditor>` import + usage from this page (the file itself stays for now; deleted in Task 22).

**Step 2: Add E2E**

```ts
test('overview shows 7 slide thumbnails and toggles visibility', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`/${orgId}/reports/performance/${reviewId}`)
  await expect(page.locator('[data-testid^="slide-thumbnail-"]')).toHaveCount(7)
  await page
    .locator('[data-testid="slide-thumbnail-ga_summary"] [data-testid="hide-slide-toggle"]')
    .click()
  await expect(page.locator('[data-testid="slide-thumbnail-ga_summary"]')).toHaveAttribute(
    'data-hidden',
    'true'
  )
})
```

**Step 3: Add visual snapshot in `tests/e2e/visual.spec.ts`**

```ts
test('report editor overview', async ({ page }) => {
  await page.goto(`/${orgId}/reports/performance/${reviewId}`)
  await page.waitForSelector('[data-testid="slide-thumbnail-cover"]')
  await expect(page).toHaveScreenshot('report-editor-overview.png', { fullPage: true })
})
```

Update baselines (`npm run test:e2e:update-snapshots`) and commit them alongside the code.

**Step 4: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/page.tsx \
  tests/e2e/reports-editor-overview.spec.ts \
  tests/e2e/visual.spec.ts \
  tests/e2e/visual.spec.ts-snapshots/report-editor-overview*.png
git rm app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/editor-header.tsx
git commit -m "feat(reports): replace editor page with overview + thumbnail strip"
```

---

## Task 19: View 2 — slide editor route + `<SlideStage>`

**Files:**

- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/slides/[slideKey]/page.tsx`
- Create: `components/reviews/editor/slide-stage.tsx`
- Test: `tests/e2e/reports-editor-slide.spec.ts`

**Step 1: Write the page**

```tsx
// page.tsx (RSC)
import { notFound } from 'next/navigation'
import { isSlideKey, getSlide, type SlideKey } from '@/lib/reviews/slides/registry'

export default async function Page({ params }: { params: Promise<{ orgId: string; id: string; slideKey: string }> }) {
  const { orgId, id, slideKey } = await params
  if (!isSlideKey(slideKey)) notFound()
  const slide = getSlide(slideKey as SlideKey)
  // load draft, narrative, data, hiddenSlides — same query as View 1
  // compose:
  return (
    <>
      <ReportEditorHeader>
        <BackLink href={`/${orgId}/reports/performance/${id}`} label="Slides" />
        <SlideTitle slide={slide} index={N} total={M} />
        <ReportHeaderActions>{/* same as View 1 */}</ReportHeaderActions>
      </ReportEditorHeader>
      <SlideStage
        slideKey={slide.key}
        organization={...}
        narrative={...}
        data={...}
        hiddenSlides={draft.hidden_slides}
        quarter={...}
        periodStart={...}
        periodEnd={...}
      />
      <SlideTray defaultExpanded>
        <TrayContent slide={slide} reviewId={id} narrative={draft.narrative} />
      </SlideTray>
    </>
  )
}
```

`<SlideStage>` is a thin client wrapper rendering `<ReviewDeck mode="editor" initialSlideKey={slideKey} ...>`. `<TrayContent>` dispatches on `slide.kind` to the matching tray editor from Task 9.

**Step 2: Write E2E**

```ts
test('slide editor route loads the deck on the requested slide', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`/${orgId}/reports/performance/${reviewId}/slides/initiatives`)
  await expect(page.locator('[data-testid="review-deck-track"]')).toHaveAttribute(
    'data-current-index',
    '4'
  )
  await expect(page.locator('[data-testid="slide-tray-content"]')).toBeVisible()
})

test('unknown slide key returns 404', async ({ page }) => {
  const r = await page.goto(`/${orgId}/reports/performance/${reviewId}/slides/not_a_slide`)
  expect(r?.status()).toBe(404)
})
```

**Step 3: Visual snapshot**

```ts
test('report editor slide cover with tray', async ({ page }) => {
  await page.goto(`/${orgId}/reports/performance/${reviewId}/slides/cover`)
  await page.waitForSelector('[data-testid="review-deck"]')
  await expect(page).toHaveScreenshot('report-editor-slide-cover.png', { fullPage: true })
})
```

**Step 4: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/slides \
  components/reviews/editor/slide-stage.tsx \
  tests/e2e/reports-editor-slide.spec.ts \
  tests/e2e/visual.spec.ts \
  tests/e2e/visual.spec.ts-snapshots/report-editor-slide-cover*.png
git commit -m "feat(reports): add slide editor route with stage and tray"
```

---

## Task 20: Hidden-slide dimming inside slide stage

**Files:**

- Modify: `components/reviews/review-deck/index.tsx` (already mode-aware; verify `<HiddenSlideOverlay>` wraps when `key in hiddenSlides && mode === 'editor'`)
- Test: `tests/e2e/reports-editor-slide.spec.ts` — extend

**Step 1: Add E2E case**

```ts
test('hidden slide on View 2 shows dim + Hidden badge but is still navigable', async ({ page }) => {
  await page.goto(`/${orgId}/reports/performance/${reviewId}/slides/ga_summary`)
  // hide ga_summary via the page action, then re-render
  await page.locator('[data-testid="hide-slide-toggle-ga_summary"]').click()
  await expect(page.locator('[data-testid="hidden-slide-overlay"]')).toBeVisible()
  await expect(page.getByText('Hidden')).toBeVisible()
})
```

If the View 2 header doesn't include a hide toggle, drive the test from the overview page or add the toggle into View 2 header (small UX win — keeps the author from bouncing back to View 1).

**Step 2: Implement** any missing wiring.

**Step 3: Commit**

```bash
git add components/reviews/review-deck/index.tsx tests/e2e/reports-editor-slide.spec.ts
git commit -m "feat(reports): dim hidden slides in slide editor"
```

---

## Task 21: Presentation-side respect for `hidden_slides`

**Files:**

- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/preview/preview-client.tsx`
- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/snapshot-client.tsx`
- Modify: `app/s/[token]/...` (the public snapshot renderer)
- Test: `tests/unit/components/reviews/review-deck/review-deck-modes.test.tsx` — add explicit "presentation filters published snapshot's hidden_slides" case.

**Step 1.** Each consumer reads `draft.hidden_slides` (preview) or `snapshot.hidden_slides` (snapshot/share) and forwards it to `<ReviewDeck hiddenSlides={...}>`. Default mode is `presentation` so filtering is automatic.

**Step 2: Add E2E** — publish a draft that has `ga_summary` hidden; visit `/preview` and the snapshot URL; assert the GA slide is absent in both.

**Step 3: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/preview \
  app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/snapshots \
  app/s tests/unit/components/reviews/review-deck/review-deck-modes.test.tsx \
  tests/e2e/reports-hidden-slides-publish.spec.ts
git commit -m "feat(reports): respect hidden_slides in preview, snapshot, and share routes"
```

---

## Task 22: Remove old editor pieces

**Files:**

- Delete: `app/(authenticated)/[orgId]/reports/performance/[id]/narrative-editor.tsx`
- Delete: `app/(authenticated)/[orgId]/reports/performance/[id]/author-notes-editor.tsx`
- Delete: `app/(authenticated)/[orgId]/reports/performance/[id]/style-memo-preview.tsx`
- Delete: matching unit tests for each (kept only if logic moved into a still-tested hook)
- Verify: no remaining imports

**Step 1.** Run a grep:

```bash
grep -rn "from.*narrative-editor\|from.*author-notes-editor\|from.*style-memo-preview" app/ components/ tests/
```

All matches must be inside the files being deleted. If anything else imports them, fix in this commit.

**Step 2.** Delete files; run `npm run lint && npm run test:unit && npm run build`. All must pass.

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor(reports): remove legacy narrative + author notes + style memo card"
```

---

## Task 23: Type-safety pass on `hidden_slides`

**Files:**

- Modify: `lib/reviews/types.ts` — add `hidden_slides: SlideKey[]` to `MarketingReviewDraft` / `MarketingReviewSnapshot` types where they exist (or define them if absent).
- Verify: `tsc --noEmit` clean.

Skip if there's no central draft/snapshot type today — the columns are read directly from Supabase responses with explicit casts.

**Commit (only if files change):**

```bash
git add lib/reviews/types.ts
git commit -m "refactor(reports): type hidden_slides on draft + snapshot"
```

---

## Task 24: Visual snapshot review

**Files:**

- Modify: `tests/e2e/visual.spec.ts` — add the new snapshots from Tasks 18 and 19.
- Generate baselines: `npm run test:e2e:update-snapshots -- visual.spec.ts`
- Review each new PNG and commit alongside.

**Commit:**

```bash
git add tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots/report-editor-*.png
git commit -m "test(reports): visual baselines for redesigned editor"
```

---

## Task 25: Final integration sweep

Run, in order:

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Fix any fallout. Common gotchas:

- **Style memo learner** at `lib/reviews/narrative/learn.ts` reads `NARRATIVE_BLOCK_KEYS` to diff blocks — unchanged by this redesign, but verify a publish from the new flow still produces a memo update.
- **Snapshot routes** — make sure the existing snapshot detail view still renders when `hidden_slides` is missing (older snapshots default to `[]` via the migration).
- **`/s/{token}` public share** — must respect `hidden_slides`.

**Commit any fixes.** Then push:

```bash
git push -u origin feature/report-editor-redesign
```

Open a PR titled "Performance report editor redesign" with the design doc link in the body.

---

## Risks & rollback

- **Migration is additive** (new column with default), so a rollback is `ALTER TABLE … DROP COLUMN hidden_slides;` — safe to ship without coordination, but easier to roll back in one commit while no consumers depend on it. The plan ships consumers in Tasks 18-21, so revert in reverse order if needed.
- **`<ReviewDeck>` mode default is `presentation`** — every existing caller is preserved without changes.
- **Removing `<NarrativeEditor>`** is the only destructive step. Land Tasks 1-21 first; Task 22 deletes once we're sure View 1 + View 2 cover the same ground.
