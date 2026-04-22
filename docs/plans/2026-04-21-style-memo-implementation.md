# Style Memo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the self-improving per-organization style memo described in `docs/plans/2026-04-21-style-memo-design.md`.

**Architecture:** New `marketing_review_style_memos` table holds one free-form text memo per org. A learner runs after each `publishReview()` via Next.js `after()`, diffs the AI's original draft against the author's final narrative + author notes, and asks Claude (`claude-opus-4-7`) to update the memo. The memo flows into every subsequent narrative prompt as a "Learned style" section. Authors can review on the editor (read-only, grouped with the indigo/purple author-notes card) and edit/clear on `/reports/performance/settings`.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `after()`), Supabase (PostgREST + RLS), Vercel AI SDK + Anthropic provider, Vitest + Testing Library, Playwright.

**Work location:** `.worktrees/style-memo` on branch `feature/style-memo` (already created; 1226 tests passing baseline).

**Design reference:** `docs/plans/2026-04-21-style-memo-design.md`.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260421230000_marketing_review_style_memos.sql`

**Step 1: Write the migration**

Full contents:

```sql
-- marketing_review_style_memos
-- Per-organization free-form style memo that the narrative learner updates after
-- each publish. Mirrors marketing_review_prompt_overrides for auth and shape, but
-- stores a single text blob rather than per-block JSON.

create table public.marketing_review_style_memos (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  memo text not null default '',
  source text not null default 'auto' check (source in ('auto', 'manual')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.marketing_review_style_memos enable row level security;

create policy "Org members can view style memo"
  on public.marketing_review_style_memos for select to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memos.organization_id
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

create policy "Org admins and internal users can manage style memo"
  on public.marketing_review_style_memos for all to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memos.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  )
  with check (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memos.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

-- Add ai_originals to snapshots so the learner can re-analyze any published
-- snapshot, not just the latest draft (drafts get overwritten each quarter).
alter table public.marketing_review_snapshots
  add column ai_originals jsonb;
```

**Step 2: Apply and verify locally**

Run: `supabase db reset`
Expected: migration runs without error; reset completes.

Then: `psql $(supabase status --output env | grep DB_URL | cut -d= -f2-) -c "\d marketing_review_style_memos"` or open Studio and confirm the table + the new `ai_originals` column on `marketing_review_snapshots`.

**Step 3: Regenerate Supabase types**

Run: `supabase gen types typescript --local > lib/supabase/database.types.ts` (if the project uses a typed client — check whether this file exists; if not, skip).

**Step 4: Commit**

```bash
git add supabase/migrations/20260421230000_marketing_review_style_memos.sql lib/supabase/database.types.ts
git commit -m "feat(reviews): add style memo table and snapshot ai_originals column"
```

---

## Task 2: Style memo loader + types

**Files:**
- Create: `lib/reviews/narrative/style-memo.ts`
- Create: `tests/unit/lib/reviews/narrative/style-memo.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/unit/lib/reviews/narrative/style-memo.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { loadStyleMemo, MAX_MEMO_CHARS, truncateMemo } from '@/lib/reviews/narrative/style-memo'

const maybeSingle = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
    }),
  }),
}))

describe('loadStyleMemo', () => {
  beforeEach(() => {
    maybeSingle.mockReset()
  })

  test('returns empty string when no row exists', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect(await loadStyleMemo('org-1')).toBe('')
  })

  test('returns empty string when the query errors', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect(await loadStyleMemo('org-1')).toBe('')
  })

  test('returns the memo field when present', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { memo: 'Be concise.' }, error: null })
    expect(await loadStyleMemo('org-1')).toBe('Be concise.')
  })

  test('returns empty string when memo column is null', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { memo: null }, error: null })
    expect(await loadStyleMemo('org-1')).toBe('')
  })
})

describe('truncateMemo', () => {
  test('returns input unchanged when under the cap', () => {
    expect(truncateMemo('short')).toBe('short')
  })

  test('truncates at the last paragraph break before the cap', () => {
    const prefix = 'para one.\n\n' + 'a'.repeat(MAX_MEMO_CHARS - 20)
    const text = prefix + '\n\npara three that overflows.'
    const result = truncateMemo(text)
    expect(result.length).toBeLessThanOrEqual(MAX_MEMO_CHARS)
    expect(result.endsWith('\n\n')).toBe(false)
  })

  test('hard-truncates when no paragraph break exists before the cap', () => {
    const text = 'x'.repeat(MAX_MEMO_CHARS + 500)
    const result = truncateMemo(text)
    expect(result.length).toBe(MAX_MEMO_CHARS)
  })
})
```

Run: `npx vitest run tests/unit/lib/reviews/narrative/style-memo.test.ts`
Expected: FAIL — module not found.

**Step 2: Implement**

```typescript
// lib/reviews/narrative/style-memo.ts
import { createServiceClient } from '@/lib/supabase/server'

export const MAX_MEMO_CHARS = 2000

/**
 * Loads the style memo for an organization. Returns an empty string when no
 * row exists or the lookup fails — the prompt pipeline treats empty memos as
 * "no learned style yet" and omits the section entirely.
 *
 * Uses the service client because this runs inside the narrative generator
 * which executes without a user session (e.g. background learning passes).
 */
export async function loadStyleMemo(organizationId: string): Promise<string> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('marketing_review_style_memos')
      .select('memo')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error || !data) return ''
    const memo = data.memo as string | null
    return memo ?? ''
  } catch (err) {
    console.error('[Style Memo Load Error]', {
      type: 'lookup_failed',
      organizationId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
    return ''
  }
}

/**
 * Caps the memo at MAX_MEMO_CHARS, preferring to cut at the last paragraph
 * break (blank line) before the limit so the memo never ends mid-sentence.
 * Falls back to a hard cut when the memo contains no paragraph breaks in the
 * first MAX_MEMO_CHARS.
 */
export function truncateMemo(memo: string): string {
  if (memo.length <= MAX_MEMO_CHARS) return memo
  const prefix = memo.slice(0, MAX_MEMO_CHARS)
  const lastBreak = prefix.lastIndexOf('\n\n')
  if (lastBreak <= 0) return prefix
  return memo.slice(0, lastBreak)
}
```

**Step 3: Run tests**

Run: `npx vitest run tests/unit/lib/reviews/narrative/style-memo.test.ts`
Expected: PASS (7 tests).

**Step 4: Commit**

```bash
git add lib/reviews/narrative/style-memo.ts tests/unit/lib/reviews/narrative/style-memo.test.ts
git commit -m "feat(reviews): add style memo loader and truncation helper"
```

---

## Task 3: Diff builder (pure function)

**Files:**
- Modify: `lib/reviews/narrative/style-memo.ts` — add `buildLearnerDiff()`
- Modify: `tests/unit/lib/reviews/narrative/style-memo.test.ts` — new `describe` block

**Step 1: Write failing test**

Append to the test file:

```typescript
import type { NarrativeBlocks } from '@/lib/reviews/types'
import { buildLearnerDiff } from '@/lib/reviews/narrative/style-memo'

describe('buildLearnerDiff', () => {
  const ai: NarrativeBlocks = {
    cover_subtitle: 'AI subtitle',
    ga_summary: 'AI ga summary',
    linkedin_insights: 'AI linkedin',
    initiatives: 'AI initiatives',
    takeaways: 'AI takeaways',
    planning: 'AI planning',
  }
  const finalNarrative: NarrativeBlocks = {
    ...ai,
    ga_summary: 'Author ga summary — punchier.',
    planning: 'Author planning.',
  }

  test('returns null when every block is unchanged and author notes are empty', () => {
    expect(buildLearnerDiff({ ai, finalNarrative: ai, authorNotes: null })).toBeNull()
  })

  test('returns null when every block is unchanged and notes are whitespace', () => {
    expect(buildLearnerDiff({ ai, finalNarrative: ai, authorNotes: '   \n ' })).toBeNull()
  })

  test('emits only the changed blocks when some differ', () => {
    const diff = buildLearnerDiff({ ai, finalNarrative, authorNotes: null })
    expect(diff).not.toBeNull()
    expect(diff!.changedBlocks.map((b) => b.key)).toEqual(['ga_summary', 'planning'])
    expect(diff!.changedBlocks[0]).toMatchObject({
      key: 'ga_summary',
      aiText: 'AI ga summary',
      finalText: 'Author ga summary — punchier.',
    })
  })

  test('emits the diff when blocks are unchanged but author notes are present', () => {
    const diff = buildLearnerDiff({
      ai,
      finalNarrative: ai,
      authorNotes: 'Q1 is always slow.',
    })
    expect(diff).not.toBeNull()
    expect(diff!.changedBlocks).toEqual([])
    expect(diff!.authorNotes).toBe('Q1 is always slow.')
  })

  test('treats missing AI or final values as empty strings for comparison', () => {
    const partialAi = { ...ai, ga_summary: '' }
    const partialFinal = { ...ai, ga_summary: 'Author wrote from scratch.' }
    const diff = buildLearnerDiff({
      ai: partialAi,
      finalNarrative: partialFinal,
      authorNotes: null,
    })
    expect(diff!.changedBlocks[0]).toMatchObject({ aiText: '', finalText: 'Author wrote from scratch.' })
  })
})
```

Run: `npx vitest run tests/unit/lib/reviews/narrative/style-memo.test.ts`
Expected: FAIL — `buildLearnerDiff` not exported.

**Step 2: Implement**

Add to `lib/reviews/narrative/style-memo.ts`:

```typescript
import { NARRATIVE_BLOCK_KEYS, type NarrativeBlockKey } from './prompts'
import type { NarrativeBlocks } from '@/lib/reviews/types'

export interface LearnerDiff {
  changedBlocks: Array<{
    key: NarrativeBlockKey
    aiText: string
    finalText: string
  }>
  authorNotes: string | null
}

export interface BuildLearnerDiffInput {
  ai: NarrativeBlocks
  finalNarrative: NarrativeBlocks
  authorNotes: string | null
}

/**
 * Builds the input for the learner by collecting blocks the author rewrote
 * alongside this quarter's author notes. Returns `null` when there is nothing
 * to learn from (no edits and no notes), which the caller uses to skip the
 * LLM call entirely.
 *
 * Comparison is whole-string equality — fine-grained semantic diffing is left
 * to the LLM since it has the full context anyway.
 */
export function buildLearnerDiff({
  ai,
  finalNarrative,
  authorNotes,
}: BuildLearnerDiffInput): LearnerDiff | null {
  const changedBlocks: LearnerDiff['changedBlocks'] = []
  for (const key of NARRATIVE_BLOCK_KEYS) {
    const aiText = (ai[key] ?? '').trim()
    const finalText = (finalNarrative[key] ?? '').trim()
    if (aiText === finalText) continue
    changedBlocks.push({ key, aiText: ai[key] ?? '', finalText: finalNarrative[key] ?? '' })
  }

  const trimmedNotes = authorNotes?.trim() ?? ''
  if (changedBlocks.length === 0 && trimmedNotes.length === 0) return null

  return { changedBlocks, authorNotes: trimmedNotes.length > 0 ? trimmedNotes : null }
}
```

**Step 3: Run tests**

Run: `npx vitest run tests/unit/lib/reviews/narrative/style-memo.test.ts`
Expected: PASS (12 tests).

**Step 4: Commit**

```bash
git add lib/reviews/narrative/style-memo.ts tests/unit/lib/reviews/narrative/style-memo.test.ts
git commit -m "feat(reviews): build learner diff input from draft vs final narrative"
```

---

## Task 4: Learner prompt builder

**Files:**
- Create: `lib/reviews/narrative/learner-prompts.ts`
- Create: `tests/unit/lib/reviews/narrative/learner-prompts.test.ts`

**Step 1: Write failing test**

```typescript
// tests/unit/lib/reviews/narrative/learner-prompts.test.ts
import { describe, test, expect } from 'vitest'
import { buildLearnerPrompt } from '@/lib/reviews/narrative/learner-prompts'
import type { LearnerDiff } from '@/lib/reviews/narrative/style-memo'

const diff: LearnerDiff = {
  changedBlocks: [
    {
      key: 'ga_summary',
      aiText: 'Sessions grew 18%.',
      finalText: 'Sessions grew 18% — organic search doing the heavy lifting.',
    },
  ],
  authorNotes: 'Q1 always dips.',
}

describe('buildLearnerPrompt', () => {
  test('includes the organization name', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toContain('ACME')
  })

  test('includes the current memo when non-empty', () => {
    const prompt = buildLearnerPrompt({
      organizationName: 'ACME',
      currentMemo: 'Existing preference: concise bullets.',
      diff,
    })
    expect(prompt).toContain('Existing preference: concise bullets.')
  })

  test('labels the empty-memo case explicitly so the LLM knows to bootstrap', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt.toLowerCase()).toContain('no existing memo')
  })

  test('includes each changed block with AI draft and author final labeled', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toContain('ga_summary')
    expect(prompt).toContain('Sessions grew 18%.')
    expect(prompt).toContain('organic search doing the heavy lifting')
  })

  test('includes author notes when present', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toContain('Q1 always dips.')
  })

  test('notes the 500-word cap so the LLM self-limits', () => {
    const prompt = buildLearnerPrompt({ organizationName: 'ACME', currentMemo: '', diff })
    expect(prompt).toMatch(/500\s+word/i)
  })
})
```

Run: `npx vitest run tests/unit/lib/reviews/narrative/learner-prompts.test.ts`
Expected: FAIL — module not found.

**Step 2: Implement**

```typescript
// lib/reviews/narrative/learner-prompts.ts
import type { LearnerDiff } from './style-memo'

export interface BuildLearnerPromptInput {
  organizationName: string
  currentMemo: string
  diff: LearnerDiff
}

/**
 * Builds the prompt fed to the style-memo learner. The learner reads the
 * existing memo, the edits the author made to this quarter's AI draft, and
 * this quarter's author notes — then rewrites the memo so it reflects
 * durable cross-quarter preferences.
 *
 * Prompt shape deliberately keeps the "durable vs. one-off" distinction front
 * and center: author notes are this quarter only, edits signal preferences,
 * and the existing memo is the running synthesis.
 */
export function buildLearnerPrompt({
  organizationName,
  currentMemo,
  diff,
}: BuildLearnerPromptInput): string {
  const memoBlock = currentMemo.trim().length > 0
    ? `EXISTING MEMO\n${currentMemo.trim()}`
    : 'EXISTING MEMO\n(no existing memo — you are bootstrapping this organization\'s style)'

  const editBlock =
    diff.changedBlocks.length === 0
      ? 'AUTHOR EDITS\n(no edits this quarter — the author accepted the AI draft as-is)'
      : [
          'AUTHOR EDITS',
          'Each block below shows what the AI produced and what the author published. Infer durable preferences from the changes.',
          '',
          ...diff.changedBlocks.flatMap((block) => [
            `### ${block.key}`,
            'AI draft:',
            block.aiText || '(empty)',
            '',
            'Author final:',
            block.finalText || '(empty)',
            '',
          ]),
        ].join('\n')

  const notesBlock = diff.authorNotes
    ? `AUTHOR NOTES FOR THIS QUARTER\n${diff.authorNotes}`
    : 'AUTHOR NOTES FOR THIS QUARTER\n(none)'

  return [
    `You are maintaining a living style memo for ${organizationName}'s quarterly performance report. The memo is consumed by a narrative-generating LLM on future quarters as soft, durable guidance.`,
    '',
    memoBlock,
    '',
    editBlock,
    '',
    notesBlock,
    '',
    'TASK',
    'Produce an updated memo that:',
    '- preserves entries from the existing memo unless new evidence clearly contradicts them;',
    '- captures what the author consistently prefers about tone, structure, bullet count, and emphasis — not this quarter\'s specific facts;',
    '- promotes recurring context from author notes (e.g. "Q1 is seasonally low") into durable preferences, but only when the pattern has likely shown up before;',
    '- expresses preferences softly ("This organization tends to…"), never prescriptively;',
    '- stays under 500 words and uses short paragraphs;',
    '- returns plain text (no markdown headings, no bullet syntax unless the author themselves uses bullets as a style preference).',
    '',
    'Return only the memo text. No preamble, no meta-commentary.',
  ].join('\n')
}
```

**Step 3: Run tests**

Run: `npx vitest run tests/unit/lib/reviews/narrative/learner-prompts.test.ts`
Expected: PASS (6 tests).

**Step 4: Commit**

```bash
git add lib/reviews/narrative/learner-prompts.ts tests/unit/lib/reviews/narrative/learner-prompts.test.ts
git commit -m "feat(reviews): build learner prompt for style memo updates"
```

---

## Task 5: Learner orchestrator

**Files:**
- Create: `lib/reviews/narrative/learn.ts`
- Create: `tests/unit/lib/reviews/narrative/learn.test.ts`

**Step 1: Write failing test**

```typescript
// tests/unit/lib/reviews/narrative/learn.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'

const generateText = vi.fn()
vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => generateText(...args),
}))

const getAnthropicProvider = vi.fn(() => ({ languageModel: vi.fn(() => 'mock-model') }))
vi.mock('@/lib/ai/anthropic', () => ({
  getAnthropicProvider: () => getAnthropicProvider(),
}))

const upsertMemo = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      upsert: (payload: unknown) => {
        upsertMemo(payload)
        return Promise.resolve({ error: null })
      },
    }),
  }),
}))

const loadStyleMemo = vi.fn()
vi.mock('@/lib/reviews/narrative/style-memo', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reviews/narrative/style-memo')>(
    '@/lib/reviews/narrative/style-memo'
  )
  return {
    ...actual,
    loadStyleMemo: (...args: unknown[]) => loadStyleMemo(...args),
  }
})

import { runStyleMemoLearner } from '@/lib/reviews/narrative/learn'
import type { NarrativeBlocks } from '@/lib/reviews/types'

const ai: NarrativeBlocks = {
  cover_subtitle: 's',
  ga_summary: 'AI ga',
  linkedin_insights: 'AI li',
  initiatives: 'AI init',
  takeaways: 'AI take',
  planning: 'AI plan',
}

beforeEach(() => {
  generateText.mockReset()
  upsertMemo.mockReset()
  loadStyleMemo.mockReset()
})

describe('runStyleMemoLearner', () => {
  test('skips LLM + upsert when no edits and no author notes', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative: ai,
      authorNotes: null,
    })
    expect(result).toEqual({ status: 'skipped' })
    expect(generateText).not.toHaveBeenCalled()
    expect(upsertMemo).not.toHaveBeenCalled()
  })

  test('calls the LLM and upserts when edits are present', async () => {
    loadStyleMemo.mockResolvedValueOnce('Existing memo.')
    generateText.mockResolvedValueOnce({ text: 'Updated memo body.' })
    const finalNarrative = { ...ai, ga_summary: 'Author rewrote.' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })

    expect(result).toEqual({ status: 'updated' })
    expect(generateText).toHaveBeenCalledTimes(1)
    expect(upsertMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        memo: 'Updated memo body.',
        source: 'auto',
        updated_by: null,
      })
    )
  })

  test('truncates when the LLM returns a memo above the cap', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    const longMemo = 'x'.repeat(3000)
    generateText.mockResolvedValueOnce({ text: longMemo })
    const finalNarrative = { ...ai, ga_summary: 'edited' }

    await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })

    const payload = upsertMemo.mock.calls[0][0] as { memo: string }
    expect(payload.memo.length).toBeLessThanOrEqual(2000)
  })

  test('returns failure status and does not upsert when the LLM returns empty text', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    generateText.mockResolvedValueOnce({ text: '   ' })
    const finalNarrative = { ...ai, ga_summary: 'edited' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })
    expect(result).toEqual({ status: 'failed', reason: 'empty_response' })
    expect(upsertMemo).not.toHaveBeenCalled()
  })

  test('returns failure status when the LLM throws', async () => {
    loadStyleMemo.mockResolvedValueOnce('')
    generateText.mockRejectedValueOnce(new Error('anthropic down'))
    const finalNarrative = { ...ai, ga_summary: 'edited' }

    const result = await runStyleMemoLearner({
      organizationId: 'org-1',
      organizationName: 'ACME',
      ai,
      finalNarrative,
      authorNotes: null,
    })
    expect(result).toEqual({ status: 'failed', reason: 'llm_error' })
    expect(upsertMemo).not.toHaveBeenCalled()
  })
})
```

Run: `npx vitest run tests/unit/lib/reviews/narrative/learn.test.ts`
Expected: FAIL — module not found.

**Step 2: Implement**

```typescript
// lib/reviews/narrative/learn.ts
import { generateText } from 'ai'
import { createServiceClient } from '@/lib/supabase/server'
import { getAnthropicProvider } from '@/lib/ai/anthropic'
import { buildLearnerDiff, loadStyleMemo, truncateMemo } from './style-memo'
import { buildLearnerPrompt } from './learner-prompts'
import type { NarrativeBlocks } from '@/lib/reviews/types'

const LEARNER_MODEL_ID = 'claude-opus-4-7'

export interface RunStyleMemoLearnerInput {
  organizationId: string
  organizationName: string
  ai: NarrativeBlocks
  finalNarrative: NarrativeBlocks
  authorNotes: string | null
}

export type RunStyleMemoLearnerResult =
  | { status: 'updated' }
  | { status: 'skipped' }
  | { status: 'failed'; reason: 'empty_response' | 'llm_error' | 'db_error' }

/**
 * Orchestrates a single learning pass. Loads the current memo, diffs the AI
 * draft against the author's final, calls the learner LLM, truncates, and
 * upserts the result. Never throws — all failure paths return a structured
 * result so the caller (publishReview via after()) can log without taking
 * down the request.
 */
export async function runStyleMemoLearner(
  input: RunStyleMemoLearnerInput
): Promise<RunStyleMemoLearnerResult> {
  try {
    const [currentMemo] = await Promise.all([loadStyleMemo(input.organizationId)])

    const diff = buildLearnerDiff({
      ai: input.ai,
      finalNarrative: input.finalNarrative,
      authorNotes: input.authorNotes,
    })

    if (diff === null) return { status: 'skipped' }

    const prompt = buildLearnerPrompt({
      organizationName: input.organizationName,
      currentMemo,
      diff,
    })

    const anthropic = await getAnthropicProvider()
    const { text } = await generateText({
      model: anthropic.languageModel(LEARNER_MODEL_ID),
      prompt,
      maxOutputTokens: 800,
    })

    const cleaned = text.trim()
    if (cleaned.length === 0) {
      console.warn('[Style Memo Learner]', { type: 'empty_response', orgId: input.organizationId })
      return { status: 'failed', reason: 'empty_response' }
    }

    const memo = truncateMemo(cleaned)

    const supabase = createServiceClient()
    const { error } = await supabase.from('marketing_review_style_memos').upsert(
      {
        organization_id: input.organizationId,
        memo,
        source: 'auto',
        updated_by: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id' }
    )

    if (error) {
      console.error('[Style Memo Learner]', {
        type: 'db_error',
        orgId: input.organizationId,
        error: error.message,
      })
      return { status: 'failed', reason: 'db_error' }
    }

    return { status: 'updated' }
  } catch (err) {
    console.error('[Style Memo Learner]', {
      type: 'llm_error',
      orgId: input.organizationId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    })
    return { status: 'failed', reason: 'llm_error' }
  }
}
```

> **Note on the upsert mock:** the test's `upsert` mock returns `{ error: null }` directly. If you find the real Supabase JS client requires `.upsert(...).select()` to trigger execution, adjust the mock chain accordingly. Prefer keeping the real call chain thin.

**Step 3: Run tests**

Run: `npx vitest run tests/unit/lib/reviews/narrative/learn.test.ts`
Expected: PASS (5 tests).

**Step 4: Commit**

```bash
git add lib/reviews/narrative/learn.ts tests/unit/lib/reviews/narrative/learn.test.ts
git commit -m "feat(reviews): style memo learner orchestrator"
```

---

## Task 6: Snapshot `ai_originals` in publishReview

**Files:**
- Modify: `lib/reviews/actions.ts` — extend the draft SELECT and snapshot INSERT to include `ai_originals`
- Modify: `tests/integration/reviews/publish-review.test.ts` (create if absent) or add a unit test asserting the insert payload

**Step 1: Locate the current INSERT**

Re-read `lib/reviews/actions.ts` at `publishReview()` (~lines 271-344). Current SELECT on line 283: `.select('data, narrative, author_notes')`.

**Step 2: Modify SELECT and INSERT**

Change line 283 from:
```typescript
.select('data, narrative, author_notes')
```
to:
```typescript
.select('data, narrative, author_notes, ai_originals')
```

And in the INSERT block (around line 313) add a new field:
```typescript
author_notes: (draft.author_notes as string | null) ?? null,
ai_originals: (draft.ai_originals as NarrativeBlocks | null) ?? null,
```

**Step 3: Add a test**

If `tests/unit/lib/reviews/publish-review.test.ts` doesn't exist, create a minimal unit test that mocks the supabase client and asserts the insert payload includes `ai_originals`. Otherwise extend it:

```typescript
// tests/unit/lib/reviews/publish-review.test.ts  (create if missing)
// Scope: just verify publishReview forwards ai_originals from draft to snapshot.
// Follow the existing mocking style in tests/unit/lib/reviews/... — check one
// of those files for the preferred supabase-client mock shape before writing.
```

Run: `npx vitest run tests/unit/lib/reviews/publish-review.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add lib/reviews/actions.ts tests/unit/lib/reviews/publish-review.test.ts
git commit -m "feat(reviews): freeze ai_originals onto published snapshot"
```

---

## Task 7: Fire learner from publishReview via `after()`

**Files:**
- Modify: `lib/reviews/actions.ts`

**Step 1: Add the import**

At the top of `lib/reviews/actions.ts`:

```typescript
import { after } from 'next/server'
import { runStyleMemoLearner } from './narrative/learn'
```

**Step 2: Schedule the learner**

After the successful `marketing_reviews` UPDATE and before the final `return { success: true, ... }` at line ~343:

```typescript
after(async () => {
  await runStyleMemoLearner({
    organizationId: review.organization_id,
    organizationName: review.organization_name,  // ensure loadReviewForAuth selects this
    ai: (draft.ai_originals as NarrativeBlocks | null) ?? ({} as NarrativeBlocks),
    finalNarrative: draft.narrative as NarrativeBlocks,
    authorNotes: (draft.author_notes as string | null) ?? null,
  })
})
```

**Step 3: Ensure `loadReviewForAuth` returns the org name**

Grep for `loadReviewForAuth` in `lib/reviews/actions.ts`. If it does not already return `organization_name`, either:

- (preferred) extend it to join `organizations(name)`, or
- add a lightweight `organizations` lookup inside `publishReview()` after the auth check.

Whichever you do, keep the change scoped — do not refactor unrelated callers of `loadReviewForAuth`.

**Step 4: Add a test for the fire-and-forget behavior**

Extend `tests/unit/lib/reviews/publish-review.test.ts`:

```typescript
test('returns success even when the learner throws', async () => {
  // Mock runStyleMemoLearner to throw, stub after() to invoke the callback inline,
  // assert publishReview still returns { success: true }.
})
```

Run: `npx vitest run tests/unit/lib/reviews/publish-review.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/reviews/actions.ts tests/unit/lib/reviews/publish-review.test.ts
git commit -m "feat(reviews): run style memo learner after publish via after()"
```

---

## Task 8: Prompt integration — "Learned style" section in header

**Files:**
- Modify: `lib/reviews/narrative/prompts.ts` — extend `header()` to accept and render `styleMemo`
- Modify: `lib/reviews/narrative/context.ts` — thread `styleMemo` through `PromptContext`
- Modify: `lib/reviews/narrative/generator.ts` — load memo and pass to context
- Modify/extend: `tests/unit/lib/reviews/narrative/prompts.test.ts`

**Step 1: Write failing tests**

Append to `tests/unit/lib/reviews/narrative/prompts.test.ts`:

```typescript
describe('header() with style memo', () => {
  // Adjust imports and helpers to match the existing tests in this file.
  test('omits the learned-style section entirely when memo is empty', () => {
    const output = header(/* minimal ctx with styleMemo: '' */)
    expect(output.toLowerCase()).not.toContain('learned style')
  })

  test('renders the learned-style section with the memo when present', () => {
    const output = header(/* ctx with styleMemo: 'Prefer punchy bullets.' */)
    expect(output).toMatch(/LEARNED STYLE/)
    expect(output).toContain('Prefer punchy bullets.')
  })

  test('places learned-style after author notes and before block instructions', () => {
    const output = header(/* ctx with styleMemo + authorNotes */)
    const authorIdx = output.toLowerCase().indexOf('author notes')
    const styleIdx = output.toLowerCase().indexOf('learned style')
    expect(authorIdx).toBeGreaterThan(-1)
    expect(styleIdx).toBeGreaterThan(authorIdx)
  })
})
```

Run: `npx vitest run tests/unit/lib/reviews/narrative/prompts.test.ts`
Expected: FAIL.

**Step 2: Implement**

Extend `PromptContext` in `context.ts` to include `styleMemo?: string` and thread it through `buildPromptContextPayload`.

In `header()` in `prompts.ts`, after the existing author-notes section:

```typescript
const memo = ctx.styleMemo?.trim() ?? ''
if (memo.length > 0) {
  lines.push('')
  lines.push('LEARNED STYLE (durable preferences from previous reports; author notes for this quarter override)')
  lines.push(memo)
}
```

In `generator.ts`, after `loadPromptOverrides(...)`:

```typescript
import { loadStyleMemo } from './style-memo'
// ...
const [overrides, styleMemo] = await Promise.all([
  loadPromptOverrides(input.organizationId),
  loadStyleMemo(input.organizationId),
])
```

Pass `styleMemo` into `buildPromptContextPayload`.

**Step 3: Update the generator test**

Extend `tests/unit/lib/reviews/narrative/generator.test.ts` to mock `loadStyleMemo` and assert the memo appears in the prompt passed to `generateObject`.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/lib/reviews/narrative/`
Expected: PASS (all files in that directory).

**Step 5: Commit**

```bash
git add lib/reviews/narrative/prompts.ts lib/reviews/narrative/context.ts lib/reviews/narrative/generator.ts tests/unit/lib/reviews/narrative/
git commit -m "feat(reviews): thread style memo into narrative prompt header"
```

---

## Task 9: Settings server actions (save / regenerate / clear)

**Files:**
- Create: `lib/reviews/narrative/style-memo-actions.ts`
- Create: `tests/unit/lib/reviews/narrative/style-memo-actions.test.ts`

**Step 1: Write failing tests**

Mirror `tests/unit/lib/reviews/narrative/settings-actions.test.ts` structure (check that file first). Test these functions:

- `saveStyleMemo(organizationId, memo)` — rejects unauthed, truncates over-cap, upserts with `source='manual'` and `updated_by=userId`.
- `clearStyleMemo(organizationId)` — rejects unauthed, upserts empty string with `source='manual'`.
- `regenerateStyleMemoFromLatestSnapshot(organizationId)` — looks up latest published snapshot for the org, re-runs the learner using its `ai_originals` + `narrative` + `author_notes`. Returns `{ success: true }` on success, `{ success: false, error }` on missing snapshot or learner failure.

Run: `npx vitest run tests/unit/lib/reviews/narrative/style-memo-actions.test.ts`
Expected: FAIL.

**Step 2: Implement**

```typescript
// lib/reviews/narrative/style-memo-actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { truncateMemo } from './style-memo'
import { runStyleMemoLearner } from './learn'
import type { NarrativeBlocks } from '@/lib/reviews/types'

type ActionOk = { success: true }
type ActionErr = { success: false; error: string }

async function authorizeAdminOrInternal(organizationId: string) {
  const user = await getAuthUser()
  if (!user) return { ok: false as const, error: 'Not authenticated' }
  const userRecord = await getUserRecord(user.id)
  if (!userRecord) return { ok: false as const, error: 'User not found' }
  const internal = isInternalUser(userRecord)
  const isAdmin =
    userRecord.organization_id === organizationId && userRecord.role === UserRole.Admin
  if (!internal && !isAdmin) return { ok: false as const, error: 'Insufficient permissions' }
  return { ok: true as const, userId: user.id }
}

export async function saveStyleMemo(
  organizationId: string,
  memo: string
): Promise<ActionOk | ActionErr> {
  const auth = await authorizeAdminOrInternal(organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { error } = await supabase.from('marketing_review_style_memos').upsert(
    {
      organization_id: organizationId,
      memo: truncateMemo(memo),
      source: 'manual',
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id' }
  )
  if (error) return { success: false, error: error.message }

  revalidatePath(`/${organizationId}/reports/performance/settings`)
  return { success: true }
}

export async function clearStyleMemo(
  organizationId: string
): Promise<ActionOk | ActionErr> {
  return saveStyleMemo(organizationId, '')
}

export async function regenerateStyleMemoFromLatestSnapshot(
  organizationId: string
): Promise<ActionOk | ActionErr> {
  const auth = await authorizeAdminOrInternal(organizationId)
  if (!auth.ok) return { success: false, error: auth.error }

  const supabase = await createClient()
  const { data: snapshot, error } = await supabase
    .from('marketing_review_snapshots')
    .select('ai_originals, narrative, author_notes, review_id, organizations:marketing_reviews!inner(organization_id, organizations!inner(name))')
    .eq('marketing_reviews.organization_id', organizationId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !snapshot) {
    return { success: false, error: 'No published snapshot to learn from' }
  }

  const organizationName =
    ((snapshot as { organizations?: { organizations?: { name?: string } } })
      ?.organizations?.organizations?.name) ?? 'Organization'

  const ai = (snapshot.ai_originals as NarrativeBlocks | null) ?? ({} as NarrativeBlocks)
  const final = snapshot.narrative as NarrativeBlocks
  const notes = (snapshot.author_notes as string | null) ?? null

  const result = await runStyleMemoLearner({
    organizationId,
    organizationName,
    ai,
    finalNarrative: final,
    authorNotes: notes,
  })

  if (result.status === 'failed') {
    return { success: false, error: `Learner failed: ${result.reason}` }
  }

  revalidatePath(`/${organizationId}/reports/performance/settings`)
  return { success: true }
}
```

> **Note:** the nested-join syntax above assumes the foreign key `marketing_review_snapshots.review_id → marketing_reviews.id` plus `marketing_reviews.organization_id → organizations.id` both exist. If PostgREST rejects that shape, rewrite as two queries (snapshot → review → org) — simpler and still performant. Verify in local Supabase before moving on.

**Step 3: Run tests**

Run: `npx vitest run tests/unit/lib/reviews/narrative/style-memo-actions.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add lib/reviews/narrative/style-memo-actions.ts tests/unit/lib/reviews/narrative/style-memo-actions.test.ts
git commit -m "feat(reviews): style memo save/clear/regenerate actions"
```

---

## Task 10: Settings UI card

**Files:**
- Create: `app/(authenticated)/[orgId]/reports/performance/settings/style-memo-card.tsx`
- Modify: `app/(authenticated)/[orgId]/reports/performance/settings/page.tsx` — render the card above the existing `PromptsForm`
- Create: `tests/unit/app/authenticated/reports/performance/style-memo-card.test.tsx`

**Design notes** (restate from `docs/plans/2026-04-21-style-memo-design.md`):

- Use the same indigo/purple accent styling as `components/reviews/author-notes-editor.tsx` — check that file for the exact class string.
- Header: Sparkles icon + **Learned style memo**; subtitle: "Claude updates this after each publish."
- Metadata line:
  - if `source='auto'`: *"Auto-updated {date}"*
  - if `source='manual'`: *"Edited by {name} on {date}"*
- Textarea bound to local state, `Save` button calls `saveStyleMemo`.
- `Regenerate from last snapshot` button with a loading spinner — calls `regenerateStyleMemoFromLatestSnapshot`, shows toast on success/failure.
- `Clear memo` button opens an `AlertDialog` confirm, calls `clearStyleMemo`.
- `data-testid` attributes: `style-memo-card`, `style-memo-textarea`, `style-memo-save-button`, `style-memo-regenerate-button`, `style-memo-clear-button`.

**Step 1: Write failing component test**

```typescript
// tests/unit/app/authenticated/reports/performance/style-memo-card.test.tsx
// - renders empty-state copy when memo is empty
// - renders source metadata ("Auto-updated ..." vs "Edited by ...")
// - disables Save while saving (via pending transition)
// - opens the clear-confirm dialog, calls clearStyleMemo on confirm
// - calls regenerateStyleMemoFromLatestSnapshot when the regenerate button is clicked
```

Mock the three server actions. Follow the pattern in `tests/unit/app/authenticated/reports/performance/preview-client.test.tsx`.

**Step 2: Implement the card**

Component receives `{ orgId, memo, source, updatedAt, updatedByName }` as props. Uses `useTransition` for each action. Do not inline the action definitions; import them from the server module.

**Step 3: Wire into the settings page**

In `settings/page.tsx`, SELECT the style memo alongside existing data and render `<StyleMemoCard ... />` above the prompts form. Resolve `updatedByName` via a simple lookup on `users` (or leave null — the card handles both states).

**Step 4: Run tests**

Run: `npx vitest run tests/unit/app/authenticated/reports/performance/`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/(authenticated)/[orgId]/reports/performance/settings/style-memo-card.tsx \
       app/(authenticated)/[orgId]/reports/performance/settings/page.tsx \
       tests/unit/app/authenticated/reports/performance/style-memo-card.test.tsx
git commit -m "feat(reviews): style memo settings card"
```

---

## Task 11: Editor read-only preview

**Files:**
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/style-memo-preview.tsx`
- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx` — fetch memo and render preview next to the existing `<AuthorNotesEditor>`
- Create: `tests/unit/app/authenticated/reports/performance/style-memo-preview.test.tsx`

**Design notes:**

- Wrapped in the same indigo/purple gradient container as author notes so the two cards read as one "AI context" cluster. Group them visually (sit side-by-side on wider screens or stacked with a shared left accent bar on narrow).
- Collapsible (default collapsed). Collapsed label: *"Style the AI is using — {wordCount} words, updated {relativeDate}"*.
- Expanded: memo text rendered as `whitespace-pre-wrap` inside a read-only `<pre>`-like div. Small link: *"Edit in settings"* → `/${orgId}/reports/performance/settings`.
- Empty-state: show the collapsed row with copy *"Style memo empty — publish your first report to start the AI learning."*
- `data-testid`: `style-memo-preview`, `style-memo-preview-toggle`, `style-memo-preview-content`.
- No Save / Edit affordances — settings is the edit surface.

**Step 1: Write failing tests**

```typescript
// - renders the empty-state message when memo is empty
// - renders the word count when collapsed
// - expands/collapses when the toggle button is clicked
// - "Edit in settings" link targets the correct settings path
```

**Step 2: Implement**

Client component with `useState` for collapsed/expanded. No server actions imported. Pure presentation.

**Step 3: Wire into the editor page**

In `app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx`, SELECT `memo, updated_at` from `marketing_review_style_memos` and pass into `<StyleMemoPreview ... />`. Place directly before `<AuthorNotesEditor />` so they cluster.

**Step 4: Run tests**

Run: `npx vitest run tests/unit/app/authenticated/reports/performance/style-memo-preview.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/(authenticated)/[orgId]/reports/performance/[id]/style-memo-preview.tsx \
       app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx \
       tests/unit/app/authenticated/reports/performance/style-memo-preview.test.tsx
git commit -m "feat(reviews): editor-side style memo preview"
```

---

## Task 12: E2E + visual snapshots

**Files:**
- Modify: `tests/e2e/performance-reports.spec.ts` — add one publish → memo-visible case
- Modify: `tests/e2e/visual.spec.ts` — add snapshot of settings page with memo card; update snapshots of the editor page to include the grouped AI-context cluster

**Step 1: Add E2E case**

Sketch:

```typescript
test('publishing a report creates a style memo visible in settings', async ({ page }) => {
  // 1. Log in as admin (use loginAsAdmin helper from tests/e2e/helpers.ts)
  // 2. Publish an existing draft report (use the seed data set up in tests/helpers/seed.ts)
  // 3. Navigate to /reports/performance/settings
  // 4. Assert [data-testid="style-memo-card"] is visible
  // 5. Assert the textarea has non-empty content (the learner ran via after())
  //    — may need to wait for a short interval or assert via a polling assertion.
})
```

> **Note on `after()` in tests:** `after()` fires after the HTTP response. Playwright will see the response, then the learner runs. Use `expect.poll` on the settings page to wait for the memo to appear. If the learner's LLM call is live in E2E, that could be flaky — consider gating the learner behind an env flag (`REVIEWS_LEARNER_ENABLED`) or stubbing `generateText` in test mode. Decide which: add a `learner-runtime-gate.ts` helper if you choose the env flag route.

**Step 2: Add visual snapshots**

Add to `tests/e2e/visual.spec.ts`:

```typescript
test('performance-reports settings with style memo card', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`/${orgId}/reports/performance/settings`)
  await page.waitForSelector('[data-testid="style-memo-card"]')
  await expect(page).toHaveScreenshot('performance-reports-settings-style-memo.png', { fullPage: true })
})
```

Also regenerate any existing snapshots that are now affected by the editor-page preview addition.

**Step 3: Run E2E + update snapshots if needed**

Run: `npm run test:e2e`
If the visuals fail as expected, inspect and: `npm run test:e2e:update-snapshots`

**Step 4: Commit**

```bash
git add tests/e2e/performance-reports.spec.ts tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots/
git commit -m "test(reviews): e2e + visual coverage for style memo"
```

---

## Task 13: Final verification + PR prep

**Step 1: Run the full verification suite**

```bash
npm run lint && npm run test:unit && npm run build
```

All must pass.

**Step 2: Review the diff end-to-end**

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
```

Confirm no debug logs, no stray `console.log`, no half-finished TODOs.

**Step 3: Push the branch**

```bash
git push -u origin feature/style-memo
```

**Step 4: Open PR**

Use `gh pr create` with a summary pointing to `docs/plans/2026-04-21-style-memo-design.md` and a test plan checklist covering: publish → memo updated; generate narrative sees memo; settings save/clear/regenerate work; editor preview renders.

---

## Notes for the implementing engineer

- **Do not** drop the existing `ai_originals` column on `marketing_review_drafts`. Both locations carry the value — draft for the live editor session, snapshot for historical learning.
- **Do not** rewrite `publishReview()` auth or structure. Keep changes additive.
- **Do not** bump the generator's model ID from `claude-opus-4-5` in this branch — that is a separate follow-up noted in the design doc.
- **Do not** feature-flag the memo. Empty memo = current behavior by design.
- If Next.js `after()` semantics behave differently than expected in local dev, verify the background call actually runs by adding a throwaway `console.log('[learner ran]')` in the learner — remove before committing.
- Grouping the editor-side memo preview with `<AuthorNotesEditor>` may require lightly refactoring either component's outer wrapper so they share chrome. Keep the refactor minimal and targeted — don't pull a "standard AI context card" abstraction unless a third consumer lands.
