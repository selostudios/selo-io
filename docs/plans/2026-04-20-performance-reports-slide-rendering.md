# Performance Reports — Phase 4: Slide Rendering Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Render the six AI-generated narrative blocks from Phase 3 as a 6-slide presentation deck, viewable via preview (draft), authenticated snapshot, and public share routes, with a minimal publish workflow.

**Architecture:** A single `<ReviewDeck>` client component tree in `components/reviews/review-deck/` is used by all four viewing surfaces. The existing `publishReview` server action already handles append-only versioning — this phase adds an empty-narrative guard, tests, and the UI surfaces (preview route, snapshot routes, public share wiring, editor page buttons).

**Tech Stack:** Next.js 16 App Router (RSC), Shadcn UI + Tailwind CSS 4, Vitest + Testing Library for unit tests, Playwright for E2E, Supabase (service client for public share reads).

**Design doc:** `docs/plans/2026-04-20-performance-reports-slide-rendering-design.md` — read it before starting.

---

## Pre-flight — verify the starting state

**Ownership confirmations:** Before starting Task 1, confirm the following are already in place (they are — this is a sanity check):

- `publishReview(reviewId)` exists at `lib/reviews/actions.ts:171-235` with version increment + `latest_snapshot_id` update + `share_token` generation.
- `marketing_review_snapshots` table has the `version` column and `unique (review_id, version)` constraint (migration `20260420161706_marketing_review_snapshots.sql`).
- `SharedResourceType.MarketingReview` enum value is wired in `lib/share/actions.ts` (revalidate path case) and `lib/share/utils.ts` (label). The `/s/[token]/client.tsx` handler at line 96 has a stub case that currently shows an error.
- Organizations have `logo_url` and `primary_color` columns (confirmed via `lib/auth/cached.ts:46`).

Run:
```bash
git log --oneline -5
npm run test:unit -- tests/unit/lib/reviews
```

Expected: tests pass (Phase 3 suite), confirming a clean baseline.

---

## Task 1: Empty-narrative guard + tests for `publishReview`

`publishReview` currently publishes a snapshot even when the narrative is `{}` (all blocks empty). That lets users publish blank decks. Add a guard and cover the behavior with unit tests.

**Files:**
- Modify: `lib/reviews/actions.ts:186-190` (add empty-narrative check after draft load)
- Create: `tests/unit/lib/reviews/actions.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/lib/reviews/actions.test.ts`:

```typescript
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/auth/cached', () => ({
  getAuthUser: vi.fn(),
  getUserRecord: vi.fn(),
}))

vi.mock('nanoid', () => ({ nanoid: () => 'test-share-token-21chars' }))

vi.mock('@/lib/reviews/period', () => ({
  periodsForQuarter: () => ({
    main: { start: '2026-01-01', end: '2026-03-31' },
    qoq: { start: '2025-10-01', end: '2025-12-31' },
    yoy: { start: '2025-01-01', end: '2025-03-31' },
  }),
}))

import { publishReview } from '@/lib/reviews/actions'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'

type SupabaseChain = ReturnType<typeof makeChain>

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    ...overrides,
  }
  return chain
}

describe('publishReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'user-1' } as never)
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'admin',
      is_internal: false,
    } as never)
  })

  test('rejects when no authenticated user', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null as never)
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          maybeSingle: async () => ({ data: { organization_id: 'org-1', quarter: 'Q1 2026' }, error: null }),
        })
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  test('rejects non-admin non-internal users', async () => {
    vi.mocked(getUserRecord).mockResolvedValue({
      organization_id: 'org-1',
      role: 'team_member',
      is_internal: false,
    } as never)
    const supabase = {
      from: vi.fn(() =>
        makeChain({
          maybeSingle: async () => ({ data: { organization_id: 'org-1', quarter: 'Q1 2026' }, error: null }),
        })
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Insufficient permissions' })
  })

  test('returns error when review not found', async () => {
    const supabase = {
      from: vi.fn(() => makeChain({ maybeSingle: async () => ({ data: null, error: null }) })),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Review not found' })
  })

  test('returns error when no draft exists', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({ data: { organization_id: 'org-1', quarter: 'Q1 2026' }, error: null }),
    })
    const draftChain = makeChain({
      single: async () => ({ data: null, error: { message: 'not found' } }),
    })
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'marketing_review_drafts' ? draftChain : reviewChain
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result.success).toBe(false)
  })

  test('returns error when narrative is empty across all blocks', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({ data: { organization_id: 'org-1', quarter: 'Q1 2026' }, error: null }),
    })
    const draftChain = makeChain({
      single: async () => ({
        data: { data: {}, narrative: { cover_subtitle: '', ga_summary: '   ' } },
        error: null,
      }),
    })
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'marketing_review_drafts' ? draftChain : reviewChain
      ),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toEqual({ success: false, error: 'Nothing to publish — narrative is empty' })
  })

  test('computes next version as 1 when no prior snapshots', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({ data: { organization_id: 'org-1', quarter: 'Q1 2026' }, error: null }),
    })
    const draftChain = makeChain({
      single: async () => ({
        data: { data: { ga: {} }, narrative: { cover_subtitle: 'hello' } },
        error: null,
      }),
    })
    const priorSnapshotChain = makeChain({
      maybeSingle: async () => ({ data: null, error: null }),
    })
    const insertChain = makeChain({
      single: async () => ({ data: { id: 'snap-1' }, error: null }),
    })
    const updateChain = makeChain()

    let draftCalled = 0
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'marketing_reviews' && draftCalled < 2) {
          draftCalled++
          return draftCalled === 1 ? reviewChain : updateChain
        }
        if (table === 'marketing_review_drafts') return draftChain
        if (table === 'marketing_review_snapshots') {
          return insertChain.insert.mock.calls.length === 0 ? priorSnapshotChain : insertChain
        }
        return makeChain()
      }),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toMatchObject({ success: true, snapshotId: 'snap-1', version: 1 })
  })

  test('computes next version as max + 1 when prior snapshots exist', async () => {
    const reviewChain = makeChain({
      maybeSingle: async () => ({ data: { organization_id: 'org-1', quarter: 'Q1 2026' }, error: null }),
    })
    const draftChain = makeChain({
      single: async () => ({
        data: { data: {}, narrative: { cover_subtitle: 'hi' } },
        error: null,
      }),
    })
    const priorSnapshotChain = makeChain({
      maybeSingle: async () => ({ data: { version: 4 }, error: null }),
    })
    const insertChain = makeChain({
      single: async () => ({ data: { id: 'snap-5' }, error: null }),
    })
    const updateChain = makeChain()

    let snapshotCallCount = 0
    let reviewCallCount = 0
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'marketing_reviews') {
          reviewCallCount++
          return reviewCallCount === 1 ? reviewChain : updateChain
        }
        if (table === 'marketing_review_drafts') return draftChain
        if (table === 'marketing_review_snapshots') {
          snapshotCallCount++
          return snapshotCallCount === 1 ? priorSnapshotChain : insertChain
        }
        return makeChain()
      }),
    }
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const result = await publishReview('review-1')
    expect(result).toMatchObject({ success: true, version: 5 })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/lib/reviews/actions.test.ts`

Expected: The "empty narrative" test FAILS because the guard does not yet exist. Other tests should pass or fail depending on existing code.

**Step 3: Add the empty-narrative guard**

In `lib/reviews/actions.ts`, after the draft-load block (around line 189), add:

```typescript
  const narrativeBlocks = (draft.narrative ?? {}) as NarrativeBlocks
  const hasContent = Object.values(narrativeBlocks).some(
    (v) => typeof v === 'string' && v.trim().length > 0
  )
  if (!hasContent) {
    return { success: false, error: 'Nothing to publish — narrative is empty' }
  }
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/lib/reviews/actions.test.ts`

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add tests/unit/lib/reviews/actions.test.ts lib/reviews/actions.ts
git commit -m "feat(reviews): guard publishReview against empty narrative, add tests"
```

---

## Task 2: `useDeckNavigation` hook + tests

A simple hook that owns the current slide index, clamps bounds, and wires keyboard handlers.

**Files:**
- Create: `components/reviews/review-deck/use-deck-navigation.ts`
- Create: `tests/unit/components/reviews/review-deck/use-deck-navigation.test.ts`

**Step 1: Write the failing tests**

```typescript
import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useDeckNavigation } from '@/components/reviews/review-deck/use-deck-navigation'

describe('useDeckNavigation', () => {
  test('starts at index 0', () => {
    const { result } = renderHook(() => useDeckNavigation(6))
    expect(result.current.currentIndex).toBe(0)
  })

  test('next() increments but does not exceed slideCount - 1', () => {
    const { result } = renderHook(() => useDeckNavigation(3))
    act(() => result.current.next())
    expect(result.current.currentIndex).toBe(1)
    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current.currentIndex).toBe(2)
  })

  test('prev() decrements but does not go below 0', () => {
    const { result } = renderHook(() => useDeckNavigation(3))
    act(() => result.current.prev())
    expect(result.current.currentIndex).toBe(0)
  })

  test('goTo() clamps out-of-range indices', () => {
    const { result } = renderHook(() => useDeckNavigation(3))
    act(() => result.current.goTo(99))
    expect(result.current.currentIndex).toBe(2)
    act(() => result.current.goTo(-5))
    expect(result.current.currentIndex).toBe(0)
  })

  test('keyboard ArrowRight calls next()', () => {
    renderHook(() => useDeckNavigation(3, { keyboardTarget: window }))
    const listener = window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    )
    expect(listener).toBe(true)
  })

  test('keyboard ArrowLeft, Space, PageUp, PageDown, Home, End are handled', () => {
    const { result } = renderHook(() => useDeckNavigation(5, { keyboardTarget: window }))
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }))
    })
    expect(result.current.currentIndex).toBe(4)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))
    })
    expect(result.current.currentIndex).toBe(0)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
    })
    expect(result.current.currentIndex).toBe(1)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp' }))
    })
    expect(result.current.currentIndex).toBe(0)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
    })
    expect(result.current.currentIndex).toBe(1)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    })
    expect(result.current.currentIndex).toBe(0)
  })

  test('keyboard handler does nothing when keyboardTarget is null', () => {
    const { result } = renderHook(() => useDeckNavigation(3, { keyboardTarget: null }))
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(result.current.currentIndex).toBe(0)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/components/reviews/review-deck/use-deck-navigation.test.ts`

Expected: FAIL — module not found.

**Step 3: Write the hook**

Create `components/reviews/review-deck/use-deck-navigation.ts`:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'

interface UseDeckNavigationOptions {
  keyboardTarget?: Window | HTMLElement | null
}

export function useDeckNavigation(
  slideCount: number,
  options: UseDeckNavigationOptions = {}
) {
  const { keyboardTarget = typeof window !== 'undefined' ? window : null } = options
  const [currentIndex, setCurrentIndex] = useState(0)

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(slideCount - 1, i)),
    [slideCount]
  )

  const next = useCallback(() => setCurrentIndex((i) => clamp(i + 1)), [clamp])
  const prev = useCallback(() => setCurrentIndex((i) => clamp(i - 1)), [clamp])
  const goTo = useCallback((i: number) => setCurrentIndex(clamp(i)), [clamp])

  useEffect(() => {
    if (!keyboardTarget) return
    const handler = (event: Event) => {
      const e = event as KeyboardEvent
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          next()
          break
        case 'ArrowLeft':
        case 'PageUp':
          prev()
          break
        case 'Home':
          goTo(0)
          break
        case 'End':
          goTo(slideCount - 1)
          break
        default:
          return
      }
    }
    keyboardTarget.addEventListener('keydown', handler)
    return () => keyboardTarget.removeEventListener('keydown', handler)
  }, [keyboardTarget, next, prev, goTo, slideCount])

  return { currentIndex, next, prev, goTo }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest tests/unit/components/reviews/review-deck/use-deck-navigation.test.ts`

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add components/reviews/review-deck/use-deck-navigation.ts tests/unit/components/reviews/review-deck/use-deck-navigation.test.ts
git commit -m "feat(review-deck): add useDeckNavigation hook with keyboard controls"
```

---

## Task 3: `<ReviewDeck>` renderer components

Build the deck, cover slide, body slide, and controls. One commit at the end — these files are tightly coupled.

**Files:**
- Create: `components/reviews/review-deck/index.tsx`
- Create: `components/reviews/review-deck/cover-slide.tsx`
- Create: `components/reviews/review-deck/body-slide.tsx`
- Create: `components/reviews/review-deck/deck-controls.tsx`
- Create: `tests/unit/components/reviews/review-deck/review-deck.test.tsx`

**Step 1: Write the failing tests**

Create `tests/unit/components/reviews/review-deck/review-deck.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ReviewDeck } from '@/components/reviews/review-deck'
import type { NarrativeBlocks } from '@/lib/reviews/types'

const fullNarrative: NarrativeBlocks = {
  cover_subtitle: 'Strong quarter across the board.',
  ga_summary: 'Sessions up 23% QoQ.',
  linkedin_insights: 'Followers grew 8%.',
  initiatives: 'Shipped SEO content and LinkedIn campaigns.',
  takeaways: 'Content velocity matters.',
  planning: 'Double down on top-performing posts.',
}

const baseProps = {
  organization: { name: 'Acme Inc', logo_url: null, primary_color: null },
  quarter: 'Q1 2026',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  data: {},
}

describe('<ReviewDeck>', () => {
  test('renders six slides for a full narrative', () => {
    render(<ReviewDeck {...baseProps} narrative={fullNarrative} />)
    expect(screen.getAllByRole('region', { name: /slide/i })).toHaveLength(6)
  })

  test('renders cover slide with org name and quarter', () => {
    render(<ReviewDeck {...baseProps} narrative={fullNarrative} />)
    expect(screen.getByText('Acme Inc')).toBeInTheDocument()
    expect(screen.getByText('Q1 2026')).toBeInTheDocument()
    expect(screen.getByText('Strong quarter across the board.')).toBeInTheDocument()
  })

  test('shows muted placeholder when a narrative block is empty', () => {
    const partial: NarrativeBlocks = { ...fullNarrative, ga_summary: '' }
    render(<ReviewDeck {...baseProps} narrative={partial} />)
    expect(screen.getByText(/no narrative available/i)).toBeInTheDocument()
  })

  test('applies primary_color to slide headings via CSS variable', () => {
    const { container } = render(
      <ReviewDeck
        {...baseProps}
        organization={{ name: 'Acme', logo_url: null, primary_color: '#ff0000' }}
        narrative={fullNarrative}
      />
    )
    const root = container.querySelector('[data-testid="review-deck"]')
    expect(root).toHaveStyle({ '--deck-accent': '#ff0000' })
  })

  test('renders org logo when logo_url is set', () => {
    render(
      <ReviewDeck
        {...baseProps}
        organization={{ name: 'Acme', logo_url: 'https://example.com/logo.png', primary_color: null }}
        narrative={fullNarrative}
      />
    )
    const img = screen.getByAltText('Acme logo')
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png')
  })

  test('omits logo image when logo_url is null', () => {
    render(
      <ReviewDeck
        {...baseProps}
        organization={{ name: 'Acme', logo_url: null, primary_color: null }}
        narrative={fullNarrative}
      />
    )
    expect(screen.queryByAltText(/logo/i)).not.toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest tests/unit/components/reviews/review-deck/review-deck.test.tsx`

Expected: FAIL — modules not found.

**Step 3: Create `components/reviews/review-deck/body-slide.tsx`**

```typescript
'use client'

interface Props {
  heading: string
  narrative: string | undefined
  index: number
  total: number
}

export function BodySlide({ heading, narrative, index, total }: Props) {
  const hasContent = typeof narrative === 'string' && narrative.trim().length > 0
  return (
    <section
      role="region"
      aria-label={`Slide ${index + 1} of ${total}: ${heading}`}
      className="flex h-full w-full flex-col items-start justify-center gap-6 px-16 py-12"
    >
      <h2
        className="text-4xl font-semibold tracking-tight"
        style={{ color: 'var(--deck-accent, inherit)' }}
      >
        {heading}
      </h2>
      {hasContent ? (
        <p className="max-w-3xl whitespace-pre-wrap text-lg leading-relaxed text-foreground">
          {narrative}
        </p>
      ) : (
        <p className="text-muted-foreground italic">
          No narrative available for this section.
        </p>
      )}
    </section>
  )
}
```

**Step 4: Create `components/reviews/review-deck/cover-slide.tsx`**

```typescript
'use client'

interface Props {
  organizationName: string
  logoUrl: string | null
  quarter: string
  periodStart: string
  periodEnd: string
  subtitle: string | undefined
  index: number
  total: number
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(s)} – ${fmt(e)}`
}

export function CoverSlide({
  organizationName,
  logoUrl,
  quarter,
  periodStart,
  periodEnd,
  subtitle,
  index,
  total,
}: Props) {
  return (
    <section
      role="region"
      aria-label={`Slide ${index + 1} of ${total}: Cover`}
      className="flex h-full w-full flex-col items-center justify-center gap-8 px-16 py-12 text-center"
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${organizationName} logo`}
          className="max-h-24 max-w-xs object-contain"
        />
      ) : null}
      <div className="space-y-3">
        <h1
          className="text-5xl font-bold tracking-tight"
          style={{ color: 'var(--deck-accent, inherit)' }}
        >
          {organizationName}
        </h1>
        <p className="text-muted-foreground text-lg">Quarterly Performance Review</p>
        <p className="text-2xl font-medium">{quarter}</p>
        <p className="text-muted-foreground text-sm">{formatPeriod(periodStart, periodEnd)}</p>
      </div>
      {subtitle && subtitle.trim().length > 0 ? (
        <p className="mt-4 max-w-2xl text-xl leading-relaxed text-foreground">{subtitle}</p>
      ) : null}
    </section>
  )
}
```

**Step 5: Create `components/reviews/review-deck/deck-controls.tsx`**

```typescript
'use client'

import { useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  fullscreenTargetRef: React.RefObject<HTMLElement | null>
}

export function DeckControls({ onPrev, onNext, canPrev, canNext, fullscreenTargetRef }: Props) {
  const handleFullscreen = useCallback(() => {
    const el = fullscreenTargetRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen?.()
    }
  }, [fullscreenTargetRef])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 left-4 -translate-y-1/2"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous slide"
        data-testid="deck-prev"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-4 -translate-y-1/2"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next slide"
        data-testid="deck-next"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-4 bottom-4"
        onClick={handleFullscreen}
        aria-label="Toggle fullscreen"
        data-testid="deck-fullscreen"
      >
        <Maximize2 className="h-5 w-5" />
      </Button>
    </>
  )
}
```

**Step 6: Create `components/reviews/review-deck/index.tsx`**

```typescript
'use client'

import { useRef } from 'react'
import type { CSSProperties } from 'react'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { CoverSlide } from './cover-slide'
import { BodySlide } from './body-slide'
import { DeckControls } from './deck-controls'
import { useDeckNavigation } from './use-deck-navigation'

interface Props {
  organization: { name: string; logo_url: string | null; primary_color: string | null }
  quarter: string
  periodStart: string
  periodEnd: string
  narrative: NarrativeBlocks
  data: SnapshotData
}

const BODY_SLIDES: Array<{ key: keyof NarrativeBlocks; heading: string }> = [
  { key: 'ga_summary', heading: 'Google Analytics' },
  { key: 'linkedin_insights', heading: 'LinkedIn' },
  { key: 'initiatives', heading: 'Initiatives' },
  { key: 'takeaways', heading: 'Takeaways' },
  { key: 'planning', heading: 'Planning Ahead' },
]

const TOTAL_SLIDES = 1 + BODY_SLIDES.length

export function ReviewDeck({
  organization,
  quarter,
  periodStart,
  periodEnd,
  narrative,
  // data is intentionally unused in Phase 4 — reserved for metric overlays in later phases
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const { currentIndex, next, prev } = useDeckNavigation(TOTAL_SLIDES)

  const deckStyle: CSSProperties = {
    ['--deck-accent' as string]: organization.primary_color ?? 'var(--foreground)',
  }

  return (
    <div
      ref={rootRef}
      data-testid="review-deck"
      className="relative h-full w-full overflow-hidden bg-background"
      style={deckStyle}
    >
      <div
        className="flex h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        <div className="h-full w-full shrink-0">
          <CoverSlide
            organizationName={organization.name}
            logoUrl={organization.logo_url}
            quarter={quarter}
            periodStart={periodStart}
            periodEnd={periodEnd}
            subtitle={narrative.cover_subtitle}
            index={0}
            total={TOTAL_SLIDES}
          />
        </div>
        {BODY_SLIDES.map((slide, i) => (
          <div key={slide.key} className="h-full w-full shrink-0">
            <BodySlide
              heading={slide.heading}
              narrative={narrative[slide.key]}
              index={i + 1}
              total={TOTAL_SLIDES}
            />
          </div>
        ))}
      </div>
      <DeckControls
        onPrev={prev}
        onNext={next}
        canPrev={currentIndex > 0}
        canNext={currentIndex < TOTAL_SLIDES - 1}
        fullscreenTargetRef={rootRef}
      />
    </div>
  )
}
```

**Step 7: Run tests to verify they pass**

Run: `npx vitest tests/unit/components/reviews/review-deck`

Expected: All 6 `<ReviewDeck>` tests PASS + the 7 hook tests from Task 2 PASS.

**Step 8: Commit**

```bash
git add components/reviews/review-deck/ tests/unit/components/reviews/review-deck/review-deck.test.tsx
git commit -m "feat(review-deck): add ReviewDeck, CoverSlide, BodySlide, DeckControls"
```

---

## Task 4: Preview route for current draft

A route that renders the deck from the draft (not a snapshot), restricted to admin/internal.

**Files:**
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/preview/page.tsx`
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/preview/preview-client.tsx`

**Step 1: Create `preview-client.tsx`**

The deck needs container size to render; wrap it in a full-viewport client component with an amber banner.

```typescript
'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReviewDeck } from '@/components/reviews/review-deck'
import { publishReview } from '@/lib/reviews/actions'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

interface Props {
  orgId: string
  reviewId: string
  organization: { name: string; logo_url: string | null; primary_color: string | null }
  quarter: string
  periodStart: string
  periodEnd: string
  narrative: NarrativeBlocks
  data: SnapshotData
}

export function PreviewClient(props: Props) {
  const router = useRouter()
  const [bannerOpen, setBannerOpen] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handlePublish = () => {
    setError(null)
    startTransition(async () => {
      const result = await publishReview(props.reviewId)
      if (result.success) {
        router.push(
          `/${props.orgId}/reports/performance/${props.reviewId}/snapshots/${result.snapshotId}`
        )
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      {bannerOpen && (
        <div
          className="flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-6 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          data-testid="preview-banner"
        >
          <span>Preview of current draft — not yet published.</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={isPending}
              data-testid="preview-publish-button"
            >
              {isPending ? 'Publishing…' : 'Publish'}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${props.orgId}/reports/performance/${props.reviewId}`}>
                Back to editor
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setBannerOpen(false)}
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div className="border-b border-destructive bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex-1">
        <ReviewDeck
          organization={props.organization}
          quarter={props.quarter}
          periodStart={props.periodStart}
          periodEnd={props.periodEnd}
          narrative={props.narrative}
          data={props.data}
        />
      </div>
    </div>
  )
}
```

**Step 2: Create `preview/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { periodsForQuarter } from '@/lib/reviews/period'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { PreviewClient } from './preview-client'

export const dynamic = 'force-dynamic'

export default async function PerformanceReportPreviewPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id } = await params

  const user = await getAuthUser()
  const userRecord = user ? await getUserRecord(user.id) : null
  const canEdit = !!userRecord && (isInternalUser(userRecord) || userRecord.role === UserRole.Admin)
  if (!canEdit) redirect(`/${orgId}/reports/performance/${id}`)

  const supabase = await createClient()
  const { data: review } = await supabase
    .from('marketing_reviews')
    .select('id, quarter, organization_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!review) redirect(`/${orgId}/reports/performance`)

  const { data: draft } = await supabase
    .from('marketing_review_drafts')
    .select('data, narrative')
    .eq('review_id', id)
    .maybeSingle()

  const { data: organization } = await supabase
    .from('organizations')
    .select('name, logo_url, primary_color')
    .eq('id', orgId)
    .single()

  if (!draft || !organization) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground" data-testid="preview-empty-state">
          Nothing to preview yet — run the initial draft.
        </p>
      </div>
    )
  }

  const periods = periodsForQuarter(review.quarter as string)

  return (
    <PreviewClient
      orgId={orgId}
      reviewId={id}
      organization={{
        name: organization.name as string,
        logo_url: (organization.logo_url as string | null) ?? null,
        primary_color: (organization.primary_color as string | null) ?? null,
      }}
      quarter={review.quarter as string}
      periodStart={periods.main.start}
      periodEnd={periods.main.end}
      narrative={(draft.narrative as NarrativeBlocks) ?? {}}
      data={(draft.data as SnapshotData) ?? {}}
    />
  )
}
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -30`

Expected: build succeeds, no type errors in the new files.

**Step 4: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/preview/
git commit -m "feat(reviews): add preview route for draft slide deck"
```

---

## Task 5: Snapshot detail route

Authenticated view of a published snapshot.

**Files:**
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/page.tsx` (replaces existing stub)

**Step 1: Replace the stub**

Overwrite `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/page.tsx`:

```typescript
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { ReviewDeck } from '@/components/reviews/review-deck'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'

export const dynamic = 'force-dynamic'

export default async function MarketingReviewSnapshotPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string; snapId: string }>
}) {
  const { orgId, id, snapId } = await params
  const supabase = await createClient()

  const { data: snapshot } = await supabase
    .from('marketing_review_snapshots')
    .select(
      'id, review_id, version, period_start, period_end, data, narrative, ' +
        'review:marketing_reviews(id, organization_id, quarter, title), ' +
        'organization:marketing_reviews(organization_id, organizations(name, logo_url, primary_color))'
    )
    .eq('id', snapId)
    .eq('review_id', id)
    .maybeSingle()

  if (!snapshot) notFound()

  const review = snapshot.review as unknown as {
    organization_id: string
    quarter: string
    title: string
  } | null
  if (!review || review.organization_id !== orgId) notFound()

  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url, primary_color')
    .eq('id', orgId)
    .single()

  if (!org) notFound()

  return (
    <div
      className="flex h-screen w-screen flex-col bg-background"
      data-testid="snapshot-detail"
    >
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {review.title} — v{snapshot.version as number}
          </p>
          <p className="text-muted-foreground text-xs">{review.quarter}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${orgId}/reports/performance/${id}/snapshots`}>Back to snapshots</Link>
        </Button>
      </div>
      <div className="flex-1">
        <ReviewDeck
          organization={{
            name: org.name as string,
            logo_url: (org.logo_url as string | null) ?? null,
            primary_color: (org.primary_color as string | null) ?? null,
          }}
          quarter={review.quarter}
          periodStart={snapshot.period_start as string}
          periodEnd={snapshot.period_end as string}
          narrative={snapshot.narrative as NarrativeBlocks}
          data={snapshot.data as SnapshotData}
        />
      </div>
    </div>
  )
}
```

**Step 2: Verify build + navigate locally**

Run: `npm run build 2>&1 | tail -30`

Expected: build succeeds.

**Step 3: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/snapshots/\[snapId\]/page.tsx
git commit -m "feat(reviews): render authenticated snapshot detail via ReviewDeck"
```

---

## Task 6: Snapshots list route

Table view of all snapshots for a review with share and view actions.

**Files:**
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/page.tsx` (replaces existing stub)
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/snapshot-share-button.tsx`

**Step 1: Create the share button client component**

```typescript
'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShareModal } from '@/components/share/share-modal'
import { SharedResourceType } from '@/lib/enums'

interface Props {
  snapshotId: string
}

export function SnapshotShareButton({ snapshotId }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid={`snapshot-share-${snapshotId}`}
      >
        <Share2 className="mr-1 h-4 w-4" />
        Share
      </Button>
      <ShareModal
        open={open}
        onOpenChange={setOpen}
        resourceType={SharedResourceType.MarketingReview}
        resourceId={snapshotId}
      />
    </>
  )
}
```

**Step 2: Create the snapshots list page**

Overwrite `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/page.tsx`:

```typescript
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { SnapshotShareButton } from './snapshot-share-button'

export const dynamic = 'force-dynamic'

interface SnapshotRow {
  id: string
  version: number
  published_at: string
  published_by: string
}

export default async function PerformanceReportSnapshotsPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id } = await params
  const supabase = await createClient()

  const { data: review } = await supabase
    .from('marketing_reviews')
    .select('id, title, quarter, organization_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!review) notFound()

  const { data: snapshots } = await supabase
    .from('marketing_review_snapshots')
    .select('id, version, published_at, published_by')
    .eq('review_id', id)
    .order('version', { ascending: false })

  const rows = (snapshots ?? []) as SnapshotRow[]

  return (
    <div className="mx-auto max-w-4xl p-8" data-testid="snapshots-list">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Snapshots</h1>
          <p className="text-muted-foreground text-sm">
            {review.title as string} — {review.quarter as string}
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={`/${orgId}/reports/performance/${id}`}>Back to editor</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <div data-testid="snapshots-empty-state">
          <EmptyState
            icon={FileText}
            title="No snapshots yet"
            description="Publish the draft from the preview page to create your first snapshot."
          />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[1%]">Version</TableHead>
                <TableHead>Published</TableHead>
                <TableHead className="w-[1%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid={`snapshot-row-${row.id}`}>
                  <TableCell className="font-medium">v{row.version}</TableCell>
                  <TableCell>{formatDate(row.published_at, false)}</TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${orgId}/reports/performance/${id}/snapshots/${row.id}`}>
                        View
                      </Link>
                    </Button>
                    <SnapshotShareButton snapshotId={row.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -30`

Expected: build succeeds.

**Step 4: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/snapshots/
git commit -m "feat(reviews): add snapshots list page with share and view actions"
```

---

## Task 7: Editor page — Preview / Publish / Snapshots buttons

Wire the three new destinations into the existing editor header.

**Files:**
- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx` (header section around lines 44-54)

**Step 1: Update the header**

Replace lines 44-54 of `page.tsx` (the `<div className="mb-6 flex items-center justify-between">` block) with:

```typescript
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{review.title as string}</h1>
          <p className="text-muted-foreground text-sm">{review.quarter as string}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="outline" asChild data-testid="preview-button">
                <Link href={`/${orgId}/reports/performance/${id}/preview`}>Preview</Link>
              </Button>
              <Button variant="outline" asChild data-testid="snapshots-button">
                <Link href={`/${orgId}/reports/performance/${id}/snapshots`}>Snapshots</Link>
              </Button>
            </>
          )}
          <Button variant="ghost" asChild>
            <Link href={`/${orgId}/reports/performance`}>Back</Link>
          </Button>
        </div>
      </div>
```

**Step 2: Verify build**

Run: `npm run build 2>&1 | tail -30`

Expected: build succeeds.

**Step 3: Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/page.tsx
git commit -m "feat(reviews): add Preview and Snapshots buttons to editor header"
```

---

## Task 8: Public share wiring

Add a service-client data fetcher for a marketing review snapshot + wire the `/s/[token]/client.tsx` MarketingReview case to render `<ReviewDeck>`.

**Files:**
- Modify: `app/s/[token]/actions.ts` (add `getSharedMarketingReviewData`)
- Modify: `app/s/[token]/client.tsx` (wire MarketingReview case + add render branch)

**Step 1: Add the data fetcher to `app/s/[token]/actions.ts`**

Append to the existing file (after the last export):

```typescript
// =============================================================================
// Marketing Review (Performance Report) shared data
// =============================================================================

export interface SharedMarketingReviewData {
  snapshot: {
    id: string
    version: number
    period_start: string
    period_end: string
    quarter: string
    data: import('@/lib/reviews/types').SnapshotData
    narrative: import('@/lib/reviews/types').NarrativeBlocks
  }
  organization: {
    name: string
    logo_url: string | null
    primary_color: string | null
  }
}

export async function getSharedMarketingReviewData(
  snapshotId: string
): Promise<SharedMarketingReviewData | null> {
  const supabase = await createServiceClient()

  const { data: snapshot, error } = await supabase
    .from('marketing_review_snapshots')
    .select(
      'id, version, period_start, period_end, data, narrative, ' +
        'review:marketing_reviews(quarter, organization_id, ' +
        'organization:organizations(name, logo_url, primary_color))'
    )
    .eq('id', snapshotId)
    .single()

  if (error || !snapshot) {
    console.error('[Shared Marketing Review Error]', {
      type: 'snapshot_fetch_failed',
      snapshotId,
      error: error?.message,
      timestamp: new Date().toISOString(),
    })
    return null
  }

  const review = snapshot.review as unknown as {
    quarter: string
    organization: { name: string; logo_url: string | null; primary_color: string | null } | null
  } | null

  if (!review?.organization) return null

  return {
    snapshot: {
      id: snapshot.id as string,
      version: snapshot.version as number,
      period_start: snapshot.period_start as string,
      period_end: snapshot.period_end as string,
      quarter: review.quarter,
      data: snapshot.data as import('@/lib/reviews/types').SnapshotData,
      narrative: snapshot.narrative as import('@/lib/reviews/types').NarrativeBlocks,
    },
    organization: review.organization,
  }
}
```

**Step 2: Wire the client dispatcher**

In `app/s/[token]/client.tsx`:

- Add import at top with the other action imports:
  ```typescript
  getSharedMarketingReviewData,
  ```
- Import type:
  ```typescript
  import type { SharedMarketingReviewData } from './actions'
  ```
- Import the deck:
  ```typescript
  import { ReviewDeck } from '@/components/reviews/review-deck'
  ```
- Update the `ResourceData` discriminated union to add:
  ```typescript
  | { type: 'marketing_review'; data: SharedMarketingReviewData }
  ```
- Replace the `case SharedResourceType.MarketingReview:` block (lines 96-99) with:
  ```typescript
  case SharedResourceType.MarketingReview: {
    const mrData = await getSharedMarketingReviewData(result.resource_id!)
    if (!mrData) {
      setError('Failed to load performance report')
      setIsLoading(false)
      return
    }
    setResourceData({ type: 'marketing_review', data: mrData })
    break
  }
  ```
- In the final render switch (around lines 200-224), add a new case:
  ```typescript
  case 'marketing_review':
    return (
      <div className="h-screen w-screen" data-testid="public-marketing-review">
        <ReviewDeck
          organization={resourceData.data.organization}
          quarter={resourceData.data.snapshot.quarter}
          periodStart={resourceData.data.snapshot.period_start}
          periodEnd={resourceData.data.snapshot.period_end}
          narrative={resourceData.data.snapshot.narrative}
          data={resourceData.data.snapshot.data}
        />
      </div>
    )
  ```

**Step 3: Verify build**

Run: `npm run build 2>&1 | tail -30`

Expected: build succeeds. No type errors.

**Step 4: Commit**

```bash
git add app/s/\[token\]/actions.ts app/s/\[token\]/client.tsx
git commit -m "feat(reviews): wire public share to render MarketingReview via ReviewDeck"
```

---

## Task 9: E2E tests + visual snapshots

Extend existing specs with Phase 4 flows.

**Files:**
- Modify: `tests/e2e/performance-reports.spec.ts` (or create if missing — check first)
- Modify: `tests/e2e/visual.spec.ts`

**Step 1: Check current state of the e2e spec**

Run: `ls tests/e2e/performance-reports.spec.ts 2>/dev/null && cat tests/e2e/performance-reports.spec.ts | head -40`

If the file exists, append to it. If not, create it following the pattern of `tests/e2e/reports.spec.ts` (read that for reference).

**Step 2: Add E2E test cases**

Add (or create) the following tests. They require a published draft — use a seeded review with narrative content, or create one via the UI in `beforeEach`.

```typescript
import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers'

test.describe('Performance Reports — Phase 4: slide rendering', () => {
  test('admin can preview the draft deck', async ({ page }) => {
    await loginAsAdmin(page)
    // Navigate to an existing review (seeded by test setup)
    await page.goto('/')
    // … flow to open a review with narrative content
    await page.click('[data-testid="preview-button"]')
    await expect(page.locator('[data-testid="review-deck"]')).toBeVisible()
    await expect(page.locator('[data-testid="preview-banner"]')).toBeVisible()
  })

  test('admin can publish from preview and land on snapshot detail', async ({ page }) => {
    await loginAsAdmin(page)
    // … open preview for a review with narrative
    await page.click('[data-testid="preview-publish-button"]')
    await expect(page).toHaveURL(/\/snapshots\/[a-f0-9-]+$/)
    await expect(page.locator('[data-testid="snapshot-detail"]')).toBeVisible()
  })

  test('admin can list snapshots and open a share modal', async ({ page }) => {
    await loginAsAdmin(page)
    // … open snapshots list for a published review
    await expect(page.locator('[data-testid="snapshots-list"]')).toBeVisible()
    await page.locator('[data-testid^="snapshot-share-"]').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('public share route renders the deck without auth', async ({ page, context }) => {
    // Create share link as admin
    await loginAsAdmin(page)
    // … open snapshots list, open share modal, create link, extract URL
    const shareUrl = 'extracted-from-modal'
    // Open in a fresh context (unauthenticated)
    await context.clearCookies()
    await page.goto(shareUrl)
    await expect(page.locator('[data-testid="public-marketing-review"]')).toBeVisible()
    await expect(page.locator('[data-testid="review-deck"]')).toBeVisible()
  })
})
```

**Note:** The e2e tests above are sketches — fill in the seed/navigation flow based on how Phase 2/3 e2e tests in this repo do it. If no review-with-narrative seed exists, skip these tests and rely on the unit/visual coverage for this phase, then add e2e in a follow-up.

**Step 3: Add visual snapshot tests**

Append to `tests/e2e/visual.spec.ts`:

```typescript
test('performance reports preview route', async ({ page }) => {
  await loginAsAdmin(page)
  // … navigate to a seeded review preview
  await page.waitForSelector('[data-testid="review-deck"]')
  await expect(page).toHaveScreenshot('performance-reports-preview.png', { fullPage: true })
})

test('performance reports snapshot detail', async ({ page }) => {
  await loginAsAdmin(page)
  // … navigate to a seeded snapshot
  await page.waitForSelector('[data-testid="snapshot-detail"]')
  await expect(page).toHaveScreenshot('performance-reports-snapshot.png', { fullPage: true })
})

test('performance reports public share', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/s/seeded-test-token')
  await page.waitForSelector('[data-testid="public-marketing-review"]')
  await expect(page).toHaveScreenshot('performance-reports-public-share.png', { fullPage: true })
})
```

**Note:** These require test data seeds that may not exist yet. If the seed infrastructure for published marketing review snapshots doesn't exist, skip the visual snapshot tests for Phase 4 and document this as a follow-up.

**Step 4: Run what you can**

Run: `npm run test:unit` (unit tests must pass)

E2E/visual: run locally if Supabase is up; otherwise defer and add seed support in a follow-up task.

**Step 5: Commit**

```bash
git add tests/e2e/performance-reports.spec.ts tests/e2e/visual.spec.ts
git commit -m "test(reviews): add Phase 4 e2e and visual snapshot test sketches"
```

---

## Task 10: Full verification and final cleanup

Run the "Before Pushing" checklist from `CLAUDE.md` end to end.

**Step 1: Format**

```bash
npm run format
```

**Step 2: Lint**

```bash
npm run lint
```

If any errors, fix and re-run. Do not disable rules.

**Step 3: Unit tests (full suite)**

```bash
npm run test:unit
```

Expected: all tests pass. Fix any regressions.

**Step 4: Build**

```bash
npm run build
```

Expected: build succeeds with no type errors.

**Step 5: Review the diff**

```bash
git log --oneline origin/main..HEAD
git diff origin/main..HEAD --stat
```

Verify:
- No `console.log` artifacts
- No commented-out debug code
- No unrelated changes
- All new files colocated per architecture (components in `components/reviews/review-deck/`, tests mirror under `tests/unit/`)

**Step 6: Final commit (if any formatting fixes were needed)**

If `npm run format` produced changes:

```bash
git add -A
git commit -m "chore: apply prettier formatting"
```

**Step 7: Summary**

Print a one-line summary per task and confirm all ten tasks are complete before handing off.

---

## Out of scope — do not implement in this plan

- PDF export (print CSS or server-side render)
- Metric data on body slides (headline stats, mini metric grids)
- Auto-fullscreen on share open
- Thumbnail strip or jump-to-slide UI
- Analytics/view tracking for public share
- Snapshot comparison/diff
- Integration tests for `publishReview` (unit tests with mocked Supabase are the chosen strategy for this phase)

## Notes for the executor

- The `publishReview` action **already exists** — Task 1 adds a guard and tests only. Do not rewrite.
- The `marketing_review_snapshots.version` column **already exists** — no migration needed.
- The `SharedResourceType.MarketingReview` enum value is already referenced in `lib/share/actions.ts` (line 73) and `lib/share/utils.ts` (line 42). Only `/s/[token]/client.tsx` needs wiring.
- The `ShareModal` component is drop-in ready — just pass `SharedResourceType.MarketingReview` + the snapshot id.
- When wiring the public share, use `createServiceClient()` (not `createClient()`) so RLS does not block unauthenticated reads.
- Prefer extracting small client components colocated with their route (as in `prompts-form.tsx` from Phase 3) over large server-side files.

## REQUIRED FOR EXECUTION

When executing this plan via subagent-driven-development, each task's tests must be written and failing before implementation is written. No skipping TDD. Every task ends with a commit.
