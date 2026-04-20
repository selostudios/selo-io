# Performance Reports — Phase 3: AI Narrative Generation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Auto-generate all six narrative blocks with Claude Opus 4.7 when a new draft is created; keep `ai_originals` write-once so human edits can always be compared against (and recovered to) the AI baseline.

**Architecture:** A new `lib/reviews/narrative/` module turns `SnapshotData` into a compact prompt context and calls `generateObject` (Vercel AI SDK) against `claude-opus-4-7` with a zod schema of six string fields. Output is written to BOTH `draft.narrative` and `draft.ai_originals` at draft-insert time. Human edits via the existing `updateNarrative` server action only mutate `draft.narrative`; `ai_originals` is never touched again. The detail page adds inline textarea editors for each block.

**Tech Stack:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`, already installed) via `getAnthropicProvider()`. Zod for output schema. Existing shadcn primitives for the editor UI.

---

## Scope decisions (from brainstorming)

- **All six blocks** — `cover_subtitle`, `ga_summary`, `linkedin_insights`, `initiatives`, `takeaways`, `planning`
- **Auto-generate on draft creation** — one call, one model invocation, structured output
- **Edits are in-line and free-form** — no regenerate button in this phase
- **`ai_originals` is write-once** — populated alongside `narrative` at creation, never updated after
- **`refreshDraftData` does NOT regenerate narrative** — it only refreshes metric `data`; human narrative work is preserved

---

## Task 3.1: Add `MarketingReviews` to `UsageFeature` enum

**Files:**

- Modify: `lib/enums.ts`

**Step 1: Add enum value**

Add `MarketingReviews = 'marketing_reviews'` to the `UsageFeature` enum (alphabetical within the existing entries).

**Step 2: Verify usage log accepts it**

Grep for `logUsage` callers and confirm the feature field is typed against `UsageFeature` — no other changes should be needed.

**Step 3: Commit**

```bash
git add lib/enums.ts
git commit -m "feat: add MarketingReviews usage feature enum"
```

---

## Task 3.2: Prompt library (one prompt per block)

**Files:**

- Create: `lib/reviews/narrative/prompts.ts`

**Step 1: Define shared types and the six prompt builders**

```ts
import type { SnapshotData } from '@/lib/reviews/types'

export interface PromptContext {
  organizationName: string
  quarter: string // '2026-Q1'
  periodStart: string // '2026-01-01'
  periodEnd: string // '2026-03-31'
  data: SnapshotData
}

export function coverSubtitlePrompt(ctx: PromptContext): string {
  /* ... */
}
export function gaSummaryPrompt(ctx: PromptContext): string {
  /* ... */
}
export function linkedinInsightsPrompt(ctx: PromptContext): string {
  /* ... */
}
export function initiativesPrompt(ctx: PromptContext): string {
  /* ... */
}
export function takeawaysPrompt(ctx: PromptContext): string {
  /* ... */
}
export function planningPrompt(ctx: PromptContext): string {
  /* ... */
}
```

**Guidance per block:**

| Block               | Length      | Tone / Purpose                                                                                                              |
| ------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `cover_subtitle`    | ≤ 20 words  | One-liner that captures the quarter's headline story (e.g. "Organic traffic up 14% while LinkedIn engagement held steady"). |
| `ga_summary`        | ≤ 120 words | Narrative over sessions, users, engagement. Callout top deltas.                                                             |
| `linkedin_insights` | ≤ 120 words | Follower growth, impression trend, top-performing themes (if top_posts present).                                            |
| `initiatives`       | ≤ 150 words | What the team shipped / focused on this quarter — inferred from metric deltas, framed positively.                           |
| `takeaways`         | ≤ 150 words | 2–3 key lessons from the data. Plain-text bullet lines OK.                                                                  |
| `planning`          | ≤ 150 words | Forward-looking: what to double down on next quarter. Opportunity-framed, not problem-framed.                               |

**Conventions (inside each prompt):**

- Always include the organization name, quarter label, and date range.
- Serialize `data` as compact JSON with two-decimal numbers — don't dump timeseries arrays (use current / qoq / yoy / qoq_delta_pct / yoy_delta_pct only).
- Close every prompt with: _"Plain text only. No markdown, asterisks, or hashes. Warm, confident, consultative tone."_

**Step 2: Commit**

```bash
git add lib/reviews/narrative/prompts.ts
git commit -m "feat: prompt library for quarterly review narratives"
```

---

## Task 3.3: Compact context serializer (TDD)

**Files:**

- Create: `lib/reviews/narrative/context.ts`
- Create: `tests/unit/lib/reviews/narrative/context.test.ts`

**Step 1: Write the failing test**

```ts
import { buildPromptContextPayload } from '@/lib/reviews/narrative/context'
import type { SnapshotData } from '@/lib/reviews/types'

test('strips timeseries + rounds numbers to 2 decimals', () => {
  const data: SnapshotData = {
    ga: {
      ga_sessions: {
        current: 1000.4567,
        qoq: 900,
        yoy: 850,
        qoq_delta_pct: 11.1111,
        yoy_delta_pct: 17.6,
        timeseries: { current: [{ date: '2026-01-01', value: 50 }], qoq: [], yoy: [] },
      },
    },
  }
  const payload = buildPromptContextPayload(data)
  expect(payload.ga?.ga_sessions).toEqual({
    current: 1000.46,
    qoq: 900,
    yoy: 850,
    qoq_delta_pct: 11.11,
    yoy_delta_pct: 17.6,
  })
  expect(JSON.stringify(payload)).not.toContain('timeseries')
})
```

**Step 2: Implement `buildPromptContextPayload`**

Walk the `SnapshotData` tree, rebuild each `MetricTriple` without `timeseries`, round numeric fields to 2 dp, leave `audit.top_failed_checks` untouched (strings already). LinkedIn `top_posts` can be included but truncate `caption` to 160 chars.

**Step 3: Commit**

```bash
git add lib/reviews/narrative/context.ts tests/unit/lib/reviews/narrative/context.test.ts
git commit -m "feat: compact prompt context serializer for review narratives"
```

---

## Task 3.4: `generateNarrativeBlocks` implementation (TDD)

**Files:**

- Create: `lib/reviews/narrative/generator.ts`
- Create: `tests/unit/lib/reviews/narrative/generator.test.ts`

**Step 1: Define zod schema + function signature**

```ts
import { z } from 'zod'
import { generateObject } from 'ai'
import { getAnthropicProvider } from '@/lib/ai/provider'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { UsageFeature } from '@/lib/enums'
import { logUsage } from '@/lib/app-settings/usage'
import { buildPromptContextPayload } from './context'
import {
  coverSubtitlePrompt,
  gaSummaryPrompt,
  linkedinInsightsPrompt,
  initiativesPrompt,
  takeawaysPrompt,
  planningPrompt,
  type PromptContext,
} from './prompts'

const NarrativeSchema = z.object({
  cover_subtitle: z.string().max(200),
  ga_summary: z.string(),
  linkedin_insights: z.string(),
  initiatives: z.string(),
  takeaways: z.string(),
  planning: z.string(),
})

export interface GenerateNarrativeInput {
  organizationId: string
  organizationName: string
  quarter: string
  periodStart: string
  periodEnd: string
  data: SnapshotData
  reviewId?: string
}

export async function generateNarrativeBlocks(
  input: GenerateNarrativeInput
): Promise<NarrativeBlocks> {
  /* ... */
}
```

**Step 2: Strategy — one model call, six prompts concatenated**

Assemble a single master prompt that contains the org/quarter/period metadata, the serialized data payload, and the six block-specific instructions (each prompt's rendered text labeled with its block key). `generateObject` with `NarrativeSchema` returns all six at once.

**Step 3: Error path + usage logging**

- Wrap `generateObject` in try/catch.
- On success: call `logUsage('anthropic', 'review_narrative_generation', { feature: UsageFeature.MarketingReviews, ... })` with usage tokens.
- On failure: log the error via the project's `[Context Error]` convention and return **empty strings for all six blocks** (not a throw — the review creation must succeed even if AI is down).

**Step 4: Tests**

```ts
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}))
vi.mock('@/lib/ai/provider', () => ({
  getAnthropicProvider: vi.fn(async () => (_: string) => 'mock-model'),
}))

test('returns all six blocks on success', async () => {
  const object = {
    cover_subtitle: 'hi',
    ga_summary: 'x',
    linkedin_insights: 'y',
    initiatives: 'z',
    takeaways: 't',
    planning: 'p',
  }
  ;(generateObject as Mock).mockResolvedValue({
    object,
    usage: { inputTokens: 100, outputTokens: 200 },
  })
  const out = await generateNarrativeBlocks({
    /* ... */
  })
  expect(out).toEqual(object)
})

test('falls back to empty strings when the model call throws', async () => {
  ;(generateObject as Mock).mockRejectedValue(new Error('network'))
  const out = await generateNarrativeBlocks({
    /* ... */
  })
  expect(out).toEqual({
    cover_subtitle: '',
    ga_summary: '',
    linkedin_insights: '',
    initiatives: '',
    takeaways: '',
    planning: '',
  })
})
```

**Step 5: Commit**

```bash
git add lib/reviews/narrative/generator.ts tests/unit/lib/reviews/narrative/
git commit -m "feat: AI narrative generator using Opus 4.7 + structured output"
```

---

## Task 3.5: Wire generator into `createReview`

**Files:**

- Modify: `lib/reviews/actions.ts`

**Step 1: In `createReview`, after `fetchAllData` resolves:**

```ts
// Load org name for the prompt context
const { data: org } = await supabase
  .from('organizations')
  .select('name')
  .eq('id', input.organizationId)
  .single()

const periods = periodsForQuarter(input.quarter)
const narrative = await generateNarrativeBlocks({
  organizationId: input.organizationId,
  organizationName: org?.name ?? 'the organization',
  quarter: input.quarter,
  periodStart: periods.main.start,
  periodEnd: periods.main.end,
  data,
  reviewId: review.id,
})

const { error: draftError } = await supabase.from('marketing_review_drafts').insert({
  review_id: review.id,
  data,
  narrative,
  ai_originals: narrative, // write-once baseline
})
```

**Step 2: Confirm `refreshDraftData` remains narrative-free**

Read the current implementation — it should only set `data` and `updated_at`. Leave it alone. Add an inline comment: `// narrative + ai_originals intentionally untouched — edits are preserved`.

**Step 3: Commit**

```bash
git add lib/reviews/actions.ts
git commit -m "feat: generate AI narrative on review creation"
```

---

## Task 3.6: Detail page narrative editor

**Files:**

- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx`
- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/narrative-editor.tsx` (client component)

**Step 1: Fetch the draft on the detail page**

Server component loads `marketing_reviews` row (for quarter/title) + the draft row (for `narrative`, `ai_originals`). If no draft exists, show a placeholder state.

**Step 2: Editor component**

Client component that accepts `{ reviewId, narrative, aiOriginals, canEdit }`.

Renders six labeled `<textarea>` blocks in order (matching the Scope decisions table ordering). Each textarea:

- Initial value from `narrative[block]` (fallback to empty string)
- Shows "edited" badge below it when `narrative[block] !== aiOriginals[block]` and `aiOriginals[block]` is non-empty
- Debounced autosave (1.5s after last keystroke) calls `updateNarrative(reviewId, block, value)`
- `canEdit = false` → textareas are read-only (`disabled`) and no save logic runs

**Step 3: Acceptance visuals**

- Labels: "Cover subtitle", "Google Analytics summary", "LinkedIn insights", "Initiatives", "Takeaways", "Planning ahead"
- Below each label, a muted hint describing the block's purpose (matches the guidance table in Task 3.2).
- `data-testid="narrative-editor-${block}"` on each textarea for E2E targeting.

**Step 4: Commit**

```bash
git add "app/(authenticated)/[orgId]/reports/performance/[id]/"
git commit -m "feat: narrative editor on review detail page"
```

---

## Task 3.7: Detail-page-level permission gating

**Files:**

- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/page.tsx`

Compute `canEdit = isInternalUser(userRecord) || userRecord.role === UserRole.Admin` using the existing cached helpers, pass to the editor. Non-admin / non-internal users see a read-only editor and no publish button. (Publish button wiring lives in a later phase.)

**Commit (combined with 3.6 if done in the same pass):**

```bash
git commit -m "feat: permission-gate narrative editor for viewers"
```

---

## Task 3.8: Migration for per-org prompt overrides

**Files:**

- Create: `supabase/migrations/<timestamp>_marketing_review_prompt_overrides.sql`

**Schema:**

```sql
create table public.marketing_review_prompt_overrides (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  prompts jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.marketing_review_prompt_overrides enable row level security;

create policy "Org members can view prompt overrides"
  on public.marketing_review_prompt_overrides for select to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_prompt_overrides.organization_id
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

create policy "Org admins and internal users can manage prompt overrides"
  on public.marketing_review_prompt_overrides for all to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_prompt_overrides.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  )
  with check (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_prompt_overrides.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

grant select, insert, update, delete on public.marketing_review_prompt_overrides to authenticated;
```

`prompts` JSONB shape: `{ [block: string]: string }` where `block` is one of the six narrative block keys. Missing keys fall back to the compiled-in defaults.

**Commit:**

```bash
git add supabase/migrations/
git commit -m "feat: marketing review prompt overrides table + RLS"
```

---

## Task 3.9: Lookup + override merging (TDD)

**Files:**

- Modify: `lib/reviews/narrative/prompts.ts` — split each prompt into two halves:
  - `defaultTemplate<Block>(): string` — the editable body shown to admins in the settings UI.
  - `<block>Prompt(ctx, template?)` — takes the optional override template (falls back to default) and wraps it with the common header (org / quarter / period / data payload) + the standard footer ("Plain text only…").
- Create: `lib/reviews/narrative/overrides.ts` with `loadPromptOverrides(organizationId)` returning `Partial<Record<NarrativeBlockKey, string>>`
- Create: `tests/unit/lib/reviews/narrative/overrides.test.ts`

**Test cases:**

1. Returns `{}` when no row exists for the org.
2. Returns only the keys that were persisted (missing keys absent from the result).
3. Unknown keys in the JSONB are dropped (strict shape enforcement against `NarrativeBlockKey`).

**Integration with the generator:**

`generateNarrativeBlocks` calls `loadPromptOverrides(input.organizationId)` before building prompts, then passes each block's override (if any) into the matching prompt builder. If the override is an empty string, treat it as "unset" and use the default.

**Commit:**

```bash
git add lib/reviews/narrative/ tests/unit/lib/reviews/narrative/
git commit -m "feat: per-org narrative prompt overrides"
```

---

## Task 3.10: Settings route + editor UI

**Files:**

- Create: `app/(authenticated)/[orgId]/reports/performance/settings/page.tsx`
- Create: `app/(authenticated)/[orgId]/reports/performance/settings/prompts-form.tsx` (client)
- Create: `lib/reviews/narrative/settings-actions.ts` with server actions `savePromptOverrides` and `resetPromptOverride`

**Route:** `/{orgId}/reports/performance/settings` — admin + internal only; others get redirected to the list page (same pattern as the `new` route).

**Page layout:**

- Header: "Performance Report — Narrative Prompt Settings" with a short explainer.
- Six collapsible sections, one per narrative block.
- Each section shows:
  - The block's purpose hint (same copy as the editor hint).
  - A labeled `<textarea>` with `value = override ?? defaultTemplate`.
  - A "Show default" toggle that reveals the compiled-in default in a read-only block for reference.
  - "Reset to default" button (calls `resetPromptOverride(orgId, block)`).
- Sticky footer: "Save all changes" — batch-submits the overrides via `savePromptOverrides(orgId, overrides)`.

**Server actions:**

- `savePromptOverrides(organizationId, overrides: Partial<Record<NarrativeBlockKey, string>>)` — auth-checks admin/internal, upserts the row, stores `updated_by = auth.uid()`.
- `resetPromptOverride(organizationId, block)` — removes just that key from the JSONB (`prompts = prompts - block`).
- Both `revalidatePath('/{orgId}/reports/performance/settings')`.

**Nav hook-up:**

- Add a cog icon button to the list page header (`/{orgId}/reports/performance`) next to "New Review", visible only to `canCreate`, linking to `./settings`.
- Add `data-testid="performance-reports-settings-button"` and `data-testid="performance-reports-settings-form"` for E2E.

**Commit:**

```bash
git add app/ lib/reviews/narrative/settings-actions.ts
git commit -m "feat: settings UI for narrative prompt overrides"
```

---

## Task 3.11: Final verification

Run the full checklist:

```bash
npm run lint
npm run test:unit
npm run build
```

All must be green. If the detail page UI changed, also run:

```bash
npx playwright test tests/e2e/visual.spec.ts
```

Then open Phase 3 PR from `performance-reports` → `main`.

---

## Out of scope (deferred to later phases)

- Regenerate button per block / regenerate-all
- AI diff view comparing `narrative` vs `ai_originals` side-by-side
- Slide rendering of narrative blocks (Phase 4)
- Streaming generation with progress UI
- Multi-language narrative generation
- Prompt version history / rollback (for now, the prompt overrides row is single-state — no versioning)
- Live preview of prompt output when editing prompts in settings
