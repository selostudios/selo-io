# Memo History & Rationale Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make the style memo's evolution visible to report authors — a per-event history table plus two surfaces (snapshot-detail callout + settings timeline) so they can see exactly what the AI learned from each published report.

**Architecture:** One new append-only table `marketing_review_style_memo_versions` records every memo state (auto and manual). The learner switches from `generateText` to `generateObject` to emit both a new memo and a one-sentence rationale. Two new server components — `SnapshotLearnerCallout` (on the snapshot detail page) and `StyleMemoHistoryTimeline` (on the settings page) — render the data. Team members can read history; only admins can mutate. Public share route is not touched.

**Tech Stack:** Supabase (Postgres + RLS), Next.js 16 App Router (RSC + Server Actions), Vercel AI SDK (`generateObject` + Zod), Shadcn UI, Vitest, Playwright.

**Design doc:** `docs/plans/2026-04-22-memo-history-design.md` — read it once before starting. All decisions referenced below come from there.

---

## Pre-flight

Confirm worktree state before dispatching the first subagent:

```bash
cd /Users/owainllewellyn/projects/Selo-OS/.worktrees/memo-history
git status         # should show "nothing to commit, working tree clean" on feature/memo-history
npm run test:unit  # must pass baseline (~1281 tests) before implementation starts
```

---

### Task 1: Migration for `marketing_review_style_memo_versions`

**Files:**

- Create: `supabase/migrations/20260422200000_marketing_review_style_memo_versions.sql`

**What to build**

An append-only versions table that mirrors the auth shape of `marketing_review_style_memos`. SELECT open to org members + internal; INSERT restricted to admins + internal; no UPDATE or DELETE policies (the table is append-only by design). Two indexes: one composite for the timeline reads, one on `snapshot_id` for the callout lookup.

Model the migration on the prior style-memo migration (`supabase/migrations/20260421230000_marketing_review_style_memos.sql`) — copy its RLS pattern verbatim so auth behaviour stays consistent.

**Step 1 — Write the migration file**

```sql
-- marketing_review_style_memo_versions
-- Append-only version history for the per-organization style memo. Each row
-- captures one state of the memo: either an auto-learner run (tied to the
-- triggering snapshot) or a manual edit from the settings card. The singleton
-- `marketing_review_style_memos` remains the authoritative current state; this
-- table is the durable audit log that powers the settings timeline and the
-- snapshot-detail learner callout.

create table public.marketing_review_style_memo_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid references public.marketing_review_snapshots(id) on delete set null,
  memo text not null,
  rationale text,
  source text not null check (source in ('auto', 'manual')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.marketing_review_style_memo_versions (organization_id, created_at desc);
create index on public.marketing_review_style_memo_versions (snapshot_id);

alter table public.marketing_review_style_memo_versions enable row level security;

create policy "Org members can view memo versions"
  on public.marketing_review_style_memo_versions for select to authenticated
  using (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memo_versions.organization_id
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

create policy "Org admins and internal users can insert memo versions"
  on public.marketing_review_style_memo_versions for insert to authenticated
  with check (
    exists (
      select 1 from team_members tm
      where tm.user_id = (select auth.uid())
        and tm.organization_id = marketing_review_style_memo_versions.organization_id
        and tm.role = 'admin'
    )
    or exists (select 1 from users u where u.id = (select auth.uid()) and u.is_internal = true)
  );

grant select, insert on public.marketing_review_style_memo_versions to authenticated;
```

**Step 2 — Apply locally**

```bash
supabase db reset
```

Expected: migration applies cleanly, no errors. Confirm with:

```bash
supabase db diff  # should be empty
```

**Step 3 — Generate TypeScript types**

```bash
npx supabase gen types typescript --local > lib/supabase/database.types.ts
```

Verify the new table appears in the generated types.

**Step 4 — Commit**

```bash
git add supabase/migrations/20260422200000_marketing_review_style_memo_versions.sql lib/supabase/database.types.ts
git commit -m "feat(reviews): add marketing_review_style_memo_versions table"
```

---

### Task 2: Shared types for memo history

**Files:**

- Create: `lib/reviews/narrative/memo-history-types.ts`
- Test: `tests/unit/lib/reviews/narrative/memo-history-types.test.ts`

**What to build**

A small, client-safe module exporting:

1. A `MemoHistoryRow` type describing a row from the versions table (id, orgId, snapshotId, memo, rationale, source, createdBy, createdAt — all camelCased for app code).
2. A `MemoHistorySource` enum (`'auto' | 'manual'`) — TypeScript string union is fine here; follow existing style-memo-shared.ts conventions.
3. A `learnerOutputSchema` Zod schema for the learner's structured output: `{ memo: string, rationale: string }`.
4. A `RATIONALE_MAX_CHARS = 500` constant plus a `truncateRationale(text: string)` helper (mirror `truncateMemo` from style-memo-shared).

No server imports — this module must be safe to import from client components.

**Step 1 — Write the failing tests**

```ts
// tests/unit/lib/reviews/narrative/memo-history-types.test.ts
import { describe, test, expect } from 'vitest'
import {
  learnerOutputSchema,
  truncateRationale,
  RATIONALE_MAX_CHARS,
} from '@/lib/reviews/narrative/memo-history-types'

describe('learnerOutputSchema', () => {
  test('accepts well-formed learner output', () => {
    const result = learnerOutputSchema.safeParse({ memo: 'A', rationale: 'B' })
    expect(result.success).toBe(true)
  })

  test('rejects missing rationale', () => {
    const result = learnerOutputSchema.safeParse({ memo: 'A' })
    expect(result.success).toBe(false)
  })

  test('rejects non-string fields', () => {
    const result = learnerOutputSchema.safeParse({ memo: 1, rationale: 'B' })
    expect(result.success).toBe(false)
  })
})

describe('truncateRationale', () => {
  test('leaves short rationales untouched', () => {
    expect(truncateRationale('Noticed author prefers plain numbers.')).toBe(
      'Noticed author prefers plain numbers.'
    )
  })

  test('trims leading and trailing whitespace', () => {
    expect(truncateRationale('   hello   ')).toBe('hello')
  })

  test('truncates at RATIONALE_MAX_CHARS with an ellipsis', () => {
    const input = 'x'.repeat(RATIONALE_MAX_CHARS + 50)
    const result = truncateRationale(input)
    expect(result.length).toBe(RATIONALE_MAX_CHARS)
    expect(result.endsWith('…')).toBe(true)
  })
})
```

**Step 2 — Run tests to confirm they fail**

```bash
npx vitest tests/unit/lib/reviews/narrative/memo-history-types.test.ts
```

Expected: module not found.

**Step 3 — Implement the module**

```ts
// lib/reviews/narrative/memo-history-types.ts
import { z } from 'zod'

export type MemoHistorySource = 'auto' | 'manual'

export interface MemoHistoryRow {
  id: string
  organizationId: string
  snapshotId: string | null
  memo: string
  rationale: string | null
  source: MemoHistorySource
  createdBy: string | null
  createdAt: string
}

export const learnerOutputSchema = z.object({
  memo: z.string(),
  rationale: z.string(),
})

export type LearnerOutput = z.infer<typeof learnerOutputSchema>

export const RATIONALE_MAX_CHARS = 500

export function truncateRationale(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= RATIONALE_MAX_CHARS) return trimmed
  return trimmed.slice(0, RATIONALE_MAX_CHARS - 1) + '…'
}
```

**Step 4 — Run tests to confirm they pass**

```bash
npx vitest tests/unit/lib/reviews/narrative/memo-history-types.test.ts
```

Expected: all three `learnerOutputSchema` + three `truncateRationale` tests pass.

**Step 5 — Commit**

```bash
git add lib/reviews/narrative/memo-history-types.ts tests/unit/lib/reviews/narrative/memo-history-types.test.ts
git commit -m "feat(reviews): add shared types and Zod schema for memo history"
```

---

### Task 3: Learner emits rationale via `generateObject`

**Files:**

- Modify: `lib/reviews/narrative/learner-prompts.ts` — extend the prompt to request a rationale.
- Modify: `lib/reviews/narrative/learn.ts` — switch from `generateText` to `generateObject`.
- Modify: `tests/unit/lib/reviews/narrative/learner-prompts.test.ts` — existing test suite; add coverage for rationale text.
- Modify: `tests/unit/lib/reviews/narrative/learn.test.ts` — update `generateText` mocks to `generateObject`.

**What to build**

1. Update the learner prompt to ask Claude for a structured output: memo text + one-sentence rationale (≤30 words, past-tense). Include the example: _"Noticed author prefers plain numbers over adverbs; reinforced that."_
2. Swap the `generateText` call in `learn.ts` for `generateObject({ model, prompt, schema: learnerOutputSchema })`. Use the `object` result.
3. Truncate both `memo` (via existing `truncateMemo`) and `rationale` (new `truncateRationale`) before anything downstream. Return the rationale as part of the `RunStyleMemoLearnerResult`:
   - `{ status: 'updated', memo: string, rationale: string }`
   - Keep skipped/failed variants unchanged.

**Do not write the version-row insert in this task.** That comes in Task 4. This task only threads the rationale through the existing flow and updates the singleton upsert exactly as today.

**Step 1 — Update `learner-prompts.ts`**

Add two things to the returned string:

1. In the TASK section, append: _"Also emit a one-sentence rationale (≤30 words), past-tense, describing what you learned about the author from the edits and how you adjusted the memo. Example: 'Noticed author prefers plain numbers over adverbs; reinforced that.' Say 'No changes needed.' if the edits don't move you to adjust the memo."_
2. Replace the final instruction _"Return only the memo text..."_ with instructions that align with structured output: _"Respond as an object with fields `memo` (the full updated memo) and `rationale` (the one-sentence explanation described above)."_

**Step 2 — Add tests for the prompt change**

Open `tests/unit/lib/reviews/narrative/learner-prompts.test.ts` and add:

```ts
test('prompt instructs the model to emit a rationale sentence', () => {
  const prompt = buildLearnerPrompt({
    organizationName: 'Acme',
    currentMemo: '',
    diff: { changedBlocks: [], authorNotes: null },
  })
  expect(prompt).toMatch(/one-sentence rationale/i)
  expect(prompt).toMatch(/past-tense/i)
})

test('prompt requests structured memo + rationale fields', () => {
  const prompt = buildLearnerPrompt({
    organizationName: 'Acme',
    currentMemo: '',
    diff: { changedBlocks: [], authorNotes: null },
  })
  expect(prompt).toMatch(/memo/)
  expect(prompt).toMatch(/rationale/)
})
```

**Step 3 — Update `learn.ts`**

```ts
import { generateObject } from 'ai'
import { learnerOutputSchema, truncateRationale } from './memo-history-types'

// ...

export type RunStyleMemoLearnerResult =
  | { status: 'updated'; memo: string; rationale: string }
  | { status: 'skipped' }
  | { status: 'failed'; reason: 'empty_response' | 'llm_error' | 'db_error' | 'unknown' }
```

Replace the `generateText` block with:

```ts
let object: { memo: string; rationale: string }
try {
  const result = await generateObject({
    model: anthropic(LEARNER_MODEL_ID),
    prompt,
    schema: learnerOutputSchema,
    maxOutputTokens: LEARNER_MAX_TOKENS,
  })
  object = result.object
} catch (err) {
  console.error('[Style Memo Error]', {
    type: 'llm_error',
    orgId: input.organizationId,
    ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
    ...(input.reviewId ? { reviewId: input.reviewId } : {}),
    error: err instanceof Error ? err.message : String(err),
    timestamp: new Date().toISOString(),
  })
  return { status: 'failed', reason: 'llm_error' }
}

const cleanedMemo = object.memo.trim()
const cleanedRationale = object.rationale.trim()

if (cleanedMemo.length === 0) {
  console.error('[Style Memo Error]', {
    type: 'empty_response',
    orgId: input.organizationId,
    timestamp: new Date().toISOString(),
  })
  return { status: 'failed', reason: 'empty_response' }
}

const memo = truncateMemo(cleanedMemo)
const rationale = truncateRationale(cleanedRationale)
```

In the singleton upsert call, nothing changes yet. The final return becomes:

```ts
return { status: 'updated', memo, rationale }
```

**Step 4 — Update existing learner unit tests**

In `tests/unit/lib/reviews/narrative/learn.test.ts`, any place the test mocks `generateText` must be switched to mock `generateObject`. The mock should return `{ object: { memo: '...', rationale: '...' } }`. Add one new test asserting the rationale is returned in the `updated` result:

```ts
test('returns rationale alongside memo on successful update', async () => {
  // ... setup ...
  const result = await runStyleMemoLearner(input)
  expect(result).toMatchObject({ status: 'updated', rationale: expect.any(String) })
})
```

**Step 5 — Run all touched tests**

```bash
npx vitest tests/unit/lib/reviews/narrative/learner-prompts.test.ts
npx vitest tests/unit/lib/reviews/narrative/learn.test.ts
```

Expected: all green.

**Step 6 — Confirm build**

```bash
RESEND_API_KEY=stub RESEND_FROM_EMAIL=stub@example.com npm run build 2>&1 | tail -5
```

Expected: `✓ Compiled successfully`.

**Step 7 — Commit**

```bash
git add lib/reviews/narrative/learner-prompts.ts lib/reviews/narrative/learn.ts \
        tests/unit/lib/reviews/narrative/learner-prompts.test.ts \
        tests/unit/lib/reviews/narrative/learn.test.ts
git commit -m "feat(reviews): learner emits rationale via generateObject"
```

---

### Task 4: Version-row insertion + dedupe guard (learner side)

**Files:**

- Create: `lib/reviews/narrative/memo-history.ts` — the shared insert + dedupe helper.
- Modify: `lib/reviews/narrative/learn.ts` — call the helper after the singleton upsert.
- Test: `tests/unit/lib/reviews/narrative/memo-history.test.ts`
- Modify: `tests/unit/lib/reviews/narrative/learn.test.ts` — assert the version insert is attempted with correct fields.

**What to build**

A server-only helper `insertMemoVersion` that:

1. Takes `{ supabase, organizationId, snapshotId, memo, rationale, source, createdBy }`.
2. Reads the most-recent version row for the org (SELECT memo ORDER BY created_at DESC LIMIT 1).
3. If the previous memo's text exactly equals the new memo, returns `{ inserted: false, reason: 'duplicate' }` without inserting.
4. Otherwise inserts a new row and returns `{ inserted: true }`. On DB error returns `{ inserted: false, reason: 'error', error }`.

The helper accepts the Supabase client as a parameter so both the service-role path (learner) and the user-auth path (settings actions) can share it.

After `learn.ts` successfully upserts the singleton, it calls `insertMemoVersion` with `source: 'auto'`, `createdBy: null`, `snapshotId: input.snapshotId ?? null`. If the insert fails, log `type: 'version_insert_error'` and continue — the overall learner result stays `{ status: 'updated', ... }` because the singleton write succeeded.

**Step 1 — Write the failing helper tests**

```ts
// tests/unit/lib/reviews/narrative/memo-history.test.ts
import { describe, test, expect, vi } from 'vitest'
import { insertMemoVersion } from '@/lib/reviews/narrative/memo-history'

function mockSupabase(options: {
  lastMemo?: string
  insertError?: { message: string } | null
  selectError?: { message: string } | null
}) {
  const insert = vi.fn(() => Promise.resolve({ error: options.insertError ?? null }))
  const maybeSingle = vi.fn(() =>
    Promise.resolve({
      data: options.lastMemo !== undefined ? { memo: options.lastMemo } : null,
      error: options.selectError ?? null,
    })
  )
  const limit = vi.fn(() => ({ maybeSingle }))
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn((table: string) => {
    if (table === 'marketing_review_style_memo_versions') {
      return { select, insert }
    }
    throw new Error(`unexpected table: ${table}`)
  })
  return { from, insert, maybeSingle }
}

describe('insertMemoVersion', () => {
  test('inserts when no prior version exists', async () => {
    const sb = mockSupabase({})
    const result = await insertMemoVersion({
      supabase: sb as never,
      organizationId: 'org-1',
      snapshotId: 'snap-1',
      memo: 'new',
      rationale: 'learned X',
      source: 'auto',
      createdBy: null,
    })
    expect(result).toEqual({ inserted: true })
    expect(sb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: 'org-1',
        snapshot_id: 'snap-1',
        memo: 'new',
        rationale: 'learned X',
        source: 'auto',
        created_by: null,
      })
    )
  })

  test('skips insert when memo matches the most recent version exactly', async () => {
    const sb = mockSupabase({ lastMemo: 'same' })
    const result = await insertMemoVersion({
      supabase: sb as never,
      organizationId: 'org-1',
      snapshotId: null,
      memo: 'same',
      rationale: null,
      source: 'manual',
      createdBy: 'user-1',
    })
    expect(result).toEqual({ inserted: false, reason: 'duplicate' })
    expect(sb.insert).not.toHaveBeenCalled()
  })

  test('surfaces DB error on insert failure', async () => {
    const sb = mockSupabase({ insertError: { message: 'boom' } })
    const result = await insertMemoVersion({
      supabase: sb as never,
      organizationId: 'org-1',
      snapshotId: null,
      memo: 'new',
      rationale: null,
      source: 'manual',
      createdBy: 'user-1',
    })
    expect(result).toEqual({ inserted: false, reason: 'error', error: 'boom' })
  })
})
```

**Step 2 — Run tests to confirm they fail**

```bash
npx vitest tests/unit/lib/reviews/narrative/memo-history.test.ts
```

Expected: module not found.

**Step 3 — Implement `memo-history.ts`**

```ts
// lib/reviews/narrative/memo-history.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MemoHistorySource } from './memo-history-types'

export interface InsertMemoVersionInput {
  supabase: SupabaseClient
  organizationId: string
  snapshotId: string | null
  memo: string
  rationale: string | null
  source: MemoHistorySource
  createdBy: string | null
}

export type InsertMemoVersionResult =
  | { inserted: true }
  | { inserted: false; reason: 'duplicate' }
  | { inserted: false; reason: 'error'; error: string }

/**
 * Append a new row to marketing_review_style_memo_versions unless the most
 * recent version for this org already has an identical memo. The dedupe guard
 * prevents timeline noise from no-op learner passes and repeat manual saves.
 */
export async function insertMemoVersion(
  input: InsertMemoVersionInput
): Promise<InsertMemoVersionResult> {
  const { data: last } = await input.supabase
    .from('marketing_review_style_memo_versions')
    .select('memo')
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (last && (last as { memo: string }).memo === input.memo) {
    return { inserted: false, reason: 'duplicate' }
  }

  const { error } = await input.supabase
    .from('marketing_review_style_memo_versions')
    .insert({
      organization_id: input.organizationId,
      snapshot_id: input.snapshotId,
      memo: input.memo,
      rationale: input.rationale,
      source: input.source,
      created_by: input.createdBy,
    })

  if (error) return { inserted: false, reason: 'error', error: error.message }
  return { inserted: true }
}
```

**Step 4 — Run tests to confirm they pass**

```bash
npx vitest tests/unit/lib/reviews/narrative/memo-history.test.ts
```

Expected: all three green.

**Step 5 — Call `insertMemoVersion` from `learn.ts`**

After the singleton upsert succeeds, add:

```ts
const versionResult = await insertMemoVersion({
  supabase,
  organizationId: input.organizationId,
  snapshotId: input.snapshotId ?? null,
  memo,
  rationale,
  source: 'auto',
  createdBy: null,
})

if (versionResult.inserted === false && versionResult.reason === 'error') {
  console.error('[Style Memo Error]', {
    type: 'version_insert_error',
    orgId: input.organizationId,
    ...(input.snapshotId ? { snapshotId: input.snapshotId } : {}),
    error: versionResult.error,
    timestamp: new Date().toISOString(),
  })
  // Non-fatal: the singleton is already correct.
}
```

Import `insertMemoVersion` from `./memo-history` at the top. Do not change the `RunStyleMemoLearnerResult` — version-insert failures do not demote the status.

**Step 6 — Update learn.test.ts**

Add a test asserting that after the upsert succeeds, `insertMemoVersion` is invoked with `source: 'auto'` and the correct `snapshotId`/`memo`/`rationale`. Stub the supabase query chain so both the upsert AND the version-history select+insert resolve. One more test asserts version-insert failure does not demote the returned status.

**Step 7 — Run all learner tests + build**

```bash
npx vitest tests/unit/lib/reviews/narrative/
RESEND_API_KEY=stub RESEND_FROM_EMAIL=stub@example.com npm run build 2>&1 | tail -5
```

Expected: all green, build succeeds.

**Step 8 — Commit**

```bash
git add lib/reviews/narrative/memo-history.ts lib/reviews/narrative/learn.ts \
        tests/unit/lib/reviews/narrative/memo-history.test.ts \
        tests/unit/lib/reviews/narrative/learn.test.ts
git commit -m "feat(reviews): insert memo version row after learner updates"
```

---

### Task 5: Version-row insertion from settings actions

**Files:**

- Modify: `lib/reviews/narrative/style-memo-actions.ts` — call `insertMemoVersion` in `saveStyleMemo`.
- Modify: `tests/unit/lib/reviews/narrative/style-memo-actions.test.ts` — extend coverage.

**What to build**

After `saveStyleMemo` successfully upserts the singleton, insert a version row with `source: 'manual'`, `snapshot_id: null`, `rationale: null`, `created_by: <auth.userId>`. Use the same dedupe helper. If the version insert returns an error, log `version_insert_error` and return `{ success: true }` regardless — the singleton write already succeeded and manual edits should not appear to fail over history-tracking issues.

`clearStyleMemo` already routes through `saveStyleMemo('')`, so it picks up the version-row behaviour for free — no separate change.

`regenerateStyleMemo` routes through `runStyleMemoLearner`, which gained version-row behaviour in Task 4 — also no change.

**Step 1 — Write the failing tests**

In `tests/unit/lib/reviews/narrative/style-memo-actions.test.ts`, add:

```ts
test('inserts a manual version row after saving a new memo', async () => {
  // ... setup: admin auth, supabase upsert succeeds, version insert returns { inserted: true }
  const result = await saveStyleMemo('org-1', 'new memo text')
  expect(result).toEqual({ success: true })
  expect(insertMemoVersionMock).toHaveBeenCalledWith(
    expect.objectContaining({
      organizationId: 'org-1',
      snapshotId: null,
      memo: 'new memo text',
      rationale: null,
      source: 'manual',
      createdBy: 'user-admin',
    })
  )
})

test('returns success even when version-row insert fails (non-fatal)', async () => {
  // ... setup: singleton upsert succeeds, version insert returns { inserted: false, reason: 'error', error: 'boom' }
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const result = await saveStyleMemo('org-1', 'new memo text')
  expect(result).toEqual({ success: true })
  expect(consoleSpy).toHaveBeenCalledWith(
    '[Style Memo Error]',
    expect.objectContaining({ type: 'version_insert_error' })
  )
  consoleSpy.mockRestore()
})
```

**Step 2 — Run tests to confirm they fail**

```bash
npx vitest tests/unit/lib/reviews/narrative/style-memo-actions.test.ts
```

Expected: the new tests fail (function does not yet call `insertMemoVersion`).

**Step 3 — Modify `style-memo-actions.ts`**

Import the helper and truncator:

```ts
import { insertMemoVersion } from './memo-history'
```

After the existing upsert to `marketing_review_style_memos` succeeds, add:

```ts
const versionResult = await insertMemoVersion({
  supabase,
  organizationId,
  snapshotId: null,
  memo: truncated,
  rationale: null,
  source: 'manual',
  createdBy: auth.userId,
})

if (versionResult.inserted === false && versionResult.reason === 'error') {
  console.error('[Style Memo Error]', {
    type: 'version_insert_error',
    orgId: organizationId,
    error: versionResult.error,
    timestamp: new Date().toISOString(),
  })
  // Non-fatal — singleton is already correct.
}
```

Then return `{ success: true }` as today.

**Step 4 — Run tests to confirm they pass**

```bash
npx vitest tests/unit/lib/reviews/narrative/style-memo-actions.test.ts
```

Expected: all green.

**Step 5 — Commit**

```bash
git add lib/reviews/narrative/style-memo-actions.ts \
        tests/unit/lib/reviews/narrative/style-memo-actions.test.ts
git commit -m "feat(reviews): insert manual memo version row on save/clear"
```

---

### Task 6: Integration test — RLS + round-trip

**Files:**

- Create: `tests/integration/reviews/memo-history-rls.test.ts`

**What to build**

A real-Supabase integration test that verifies three things:

1. **Anon blocked:** anon client SELECT from `marketing_review_style_memo_versions` returns 0 rows.
2. **Cross-org isolation:** team member of org A cannot see org B's versions.
3. **Admin-only insert:** team-member role (non-admin) cannot INSERT; admin can.

Follow the existing integration-test pattern (`tests/integration/` — look for a similar RLS test e.g. `tests/integration/reviews/style-memo-rls.test.ts` if present, or model on `tests/integration/audit/rls.test.ts`). Use `tests/helpers/db.ts` for client factories.

**Step 1 — Check what RLS tests already exist**

```bash
ls tests/integration/reviews/ 2>&1 || echo "no reviews integration dir yet"
ls tests/integration/ 2>&1
```

If there's no `tests/integration/reviews/` directory, create it. Follow the structure of the closest neighbour.

**Step 2 — Write the failing test**

The test should seed two orgs with memos + versions and assert the RLS policies block cross-org reads. Use the existing test-helper patterns for creating users/orgs/team_members.

**Step 3 — Run it**

```bash
npm run test:integration -- tests/integration/reviews/memo-history-rls.test.ts
```

Expected: all assertions pass. If Supabase is not running, the test runner will tell you — start it with `supabase start`.

**Step 4 — Commit**

```bash
git add tests/integration/reviews/memo-history-rls.test.ts
git commit -m "test(reviews): integration coverage for memo history RLS"
```

---

### Task 7: `SnapshotLearnerCallout` component

**Files:**

- Create: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/snapshot-learner-callout.tsx`
- Modify: `app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/page.tsx` — fetch + render the callout under the deck.
- Test: `tests/unit/app/authenticated/reports/performance/snapshot-learner-callout.test.tsx`

**What to build**

A server component that receives `{ snapshotId, orgId, canManage }`. It fetches the auto version row for this snapshot. If no row, returns `null`. If a row exists, renders a small card with:

- Title: _"What the AI learned from this report"_
- Rationale text as the body
- Relative timestamp (e.g. `2 days ago`) — use `formatDistanceToNow` from `date-fns`
- If `canManage`: a _"View full history"_ link to `/{orgId}/reports/performance/settings#memo-history`

Visual style: muted background (`bg-muted/30`), small left-accent bar, rounded, `p-4`, no heavy chrome. Match the `AuthorNotesEditor` gradient pattern loosely but subdued.

`data-testid="snapshot-learner-callout"` on the root; `snapshot-learner-callout-rationale` on the body.

**Step 1 — Write the failing component test**

```tsx
// tests/unit/app/authenticated/reports/performance/snapshot-learner-callout.test.tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SnapshotLearnerCallout } from '@/app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/snapshot-learner-callout'

// Server component — test via rendering the async result.
// See existing RSC tests for the `await` pattern.

test('renders rationale when an auto version row exists', async () => {
  // mock createClient to return { rationale: '...', created_at: '...' }
  const jsx = await SnapshotLearnerCallout({
    snapshotId: 'snap-1',
    orgId: 'org-1',
    canManage: true,
  })
  render(jsx!)
  expect(screen.getByTestId('snapshot-learner-callout')).toBeInTheDocument()
  expect(screen.getByTestId('snapshot-learner-callout-rationale')).toHaveTextContent(
    'Noticed author prefers plain numbers.'
  )
  expect(screen.getByText(/View full history/i)).toBeInTheDocument()
})

test('hides the history link when canManage is false', async () => {
  const jsx = await SnapshotLearnerCallout({
    snapshotId: 'snap-1',
    orgId: 'org-1',
    canManage: false,
  })
  render(jsx!)
  expect(screen.queryByText(/View full history/i)).toBeNull()
})

test('returns null when no version row exists for the snapshot', async () => {
  // mock createClient to return { data: null }
  const jsx = await SnapshotLearnerCallout({
    snapshotId: 'snap-missing',
    orgId: 'org-1',
    canManage: true,
  })
  expect(jsx).toBeNull()
})
```

Mock `@/lib/supabase/server`'s `createClient` with `vi.mock` — see `tests/unit/app/authenticated/reports/performance/style-memo-preview.test.tsx` for a working pattern.

**Step 2 — Run tests to confirm they fail**

```bash
npx vitest tests/unit/app/authenticated/reports/performance/snapshot-learner-callout.test.tsx
```

Expected: module not found.

**Step 3 — Implement the component**

```tsx
// app/(authenticated)/[orgId]/reports/performance/[id]/snapshots/[snapId]/snapshot-learner-callout.tsx
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { Sparkles } from 'lucide-react'

interface Props {
  snapshotId: string
  orgId: string
  canManage: boolean
}

export async function SnapshotLearnerCallout({ snapshotId, orgId, canManage }: Props) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketing_review_style_memo_versions')
    .select('rationale, created_at')
    .eq('snapshot_id', snapshotId)
    .eq('source', 'auto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const row = data as { rationale: string | null; created_at: string } | null
  if (!row || !row.rationale) return null

  const relative = formatDistanceToNow(new Date(row.created_at), { addSuffix: true })

  return (
    <div
      data-testid="snapshot-learner-callout"
      className="relative overflow-hidden rounded-lg border bg-muted/30 p-4"
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-primary/60" />
      <div className="pl-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          What the AI learned from this report
        </div>
        <p
          data-testid="snapshot-learner-callout-rationale"
          className="mt-1 text-sm text-muted-foreground"
        >
          {row.rationale}
        </p>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{relative}</span>
          {canManage && (
            <Link
              href={`/${orgId}/reports/performance/settings#memo-history`}
              className="underline-offset-2 hover:underline"
            >
              View full history
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 4 — Mount on the snapshot detail page**

In `page.tsx`, after the deck and before any nav chrome, render:

```tsx
<SnapshotLearnerCallout
  snapshotId={snapshot.id}
  orgId={orgId}
  canManage={isInternal || userRole === UserRole.Admin}
/>
```

Derive `isInternal`/`userRole` via `getUserRecord` the same way the settings page does.

**Step 5 — Run tests + build**

```bash
npx vitest tests/unit/app/authenticated/reports/performance/snapshot-learner-callout.test.tsx
RESEND_API_KEY=stub RESEND_FROM_EMAIL=stub@example.com npm run build 2>&1 | tail -5
```

Expected: tests pass, build succeeds.

**Step 6 — Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/snapshots/\[snapId\]/snapshot-learner-callout.tsx \
        app/\(authenticated\)/\[orgId\]/reports/performance/\[id\]/snapshots/\[snapId\]/page.tsx \
        tests/unit/app/authenticated/reports/performance/snapshot-learner-callout.test.tsx
git commit -m "feat(reviews): snapshot-detail callout for AI learning rationale"
```

---

### Task 8: `StyleMemoHistoryTimeline` component

**Files:**

- Create: `app/(authenticated)/[orgId]/reports/performance/settings/style-memo-history-timeline.tsx`
- Create: `app/(authenticated)/[orgId]/reports/performance/settings/style-memo-history-row.tsx` — client component for expand/collapse per row.
- Modify: `app/(authenticated)/[orgId]/reports/performance/settings/page.tsx` — render `<StyleMemoHistoryTimeline orgId={orgId} />` below the `<StyleMemoCard>`.
- Test: `tests/unit/app/authenticated/reports/performance/style-memo-history-timeline.test.tsx`

**What to build**

**Server component `StyleMemoHistoryTimeline`:**

- Fetches the 50 most recent rows for the org, joining against `marketing_review_snapshots` → `marketing_reviews` to recover `review_id` + `quarter` label per row (where `snapshot_id` is present).
- Fetches `users.first_name, last_name` for manual-edit rows (`created_by`).
- Renders a heading _"Memo history"_ with id `memo-history` (for deep-linking from the snapshot callout).
- Renders empty state when no rows: _"No history yet — publish a report or edit the memo to see learning events here."_
- Renders each row via `<StyleMemoHistoryRow>`.
- `data-testid="style-memo-history-timeline"` on the root; `style-memo-history-empty-state` on empty; `style-memo-history-row-{index}` on each row.

**Client component `StyleMemoHistoryRow`:**

- Props: `{ row, adminName?, reviewId?, quarterLabel? }`.
- Renders: date (`formatDistanceToNow`), source badge (Auto/Manual via Shadcn Badge variant), body (rationale for auto, _"Manual edit by {name}"_ or _"Manual edit"_ for manual), expandable _"View memo"_ button revealing the memo text in a muted bordered block, and a _"From {quarter} report"_ link when `reviewId` is present.
- Expand state via `useState`.

**Step 1 — Write the failing component test**

```tsx
// tests/unit/app/authenticated/reports/performance/style-memo-history-timeline.test.tsx
import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock supabase createClient and chain it to return a list of fixture rows.
// Follow the pattern in tests/unit/app/authenticated/reports/performance/style-memo-preview.test.tsx

test('renders empty state when no rows exist', async () => {
  // ... mock returns []
  const jsx = await StyleMemoHistoryTimeline({ orgId: 'org-1' })
  render(jsx)
  expect(screen.getByTestId('style-memo-history-empty-state')).toBeInTheDocument()
})

test('renders one row per version ordered newest first', async () => {
  // ... mock returns 2 rows
  const jsx = await StyleMemoHistoryTimeline({ orgId: 'org-1' })
  render(jsx)
  expect(screen.getByTestId('style-memo-history-row-0')).toBeInTheDocument()
  expect(screen.getByTestId('style-memo-history-row-1')).toBeInTheDocument()
})

test('auto row shows rationale and Auto badge', async () => {
  // ... mock returns [{ source: 'auto', rationale: 'Noticed X.' }]
  const jsx = await StyleMemoHistoryTimeline({ orgId: 'org-1' })
  render(jsx)
  expect(screen.getByText('Noticed X.')).toBeInTheDocument()
  expect(screen.getByText('Auto')).toBeInTheDocument()
})

test('manual row shows admin name and Manual badge', async () => {
  // ... mock returns [{ source: 'manual', created_by: 'user-1' }] + admin fetch returns { first_name: 'Owain' }
  const jsx = await StyleMemoHistoryTimeline({ orgId: 'org-1' })
  render(jsx)
  expect(screen.getByText(/Manual edit by Owain/)).toBeInTheDocument()
  expect(screen.getByText('Manual')).toBeInTheDocument()
})
```

**Step 2 — Run tests to confirm they fail**

```bash
npx vitest tests/unit/app/authenticated/reports/performance/style-memo-history-timeline.test.tsx
```

Expected: module not found.

**Step 3 — Implement `StyleMemoHistoryRow` (client)**

```tsx
// app/(authenticated)/[orgId]/reports/performance/settings/style-memo-history-row.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { MemoHistoryRow } from '@/lib/reviews/narrative/memo-history-types'

interface Props {
  row: MemoHistoryRow
  adminName: string | null
  reviewId: string | null
  quarterLabel: string | null
  orgId: string
  index: number
}

export function StyleMemoHistoryRow({
  row,
  adminName,
  reviewId,
  quarterLabel,
  orgId,
  index,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const relative = formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })

  return (
    <div
      data-testid={`style-memo-history-row-${index}`}
      className="rounded-lg border p-3 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={row.source === 'auto' ? 'default' : 'secondary'}>
              {row.source === 'auto' ? 'Auto' : 'Manual'}
            </Badge>
            <span className="text-muted-foreground">{relative}</span>
          </div>
          <p className="text-sm">
            {row.source === 'auto'
              ? row.rationale
              : adminName
                ? `Manual edit by ${adminName}`
                : 'Manual edit'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          data-testid={`style-memo-history-expand-${index}`}
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          View memo
        </Button>
        {reviewId && quarterLabel && (
          <Link
            href={`/${orgId}/reports/performance/${reviewId}`}
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            From {quarterLabel} report
          </Link>
        )}
      </div>
      {expanded && (
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          {row.memo || '(empty memo)'}
        </pre>
      )}
    </div>
  )
}
```

**Step 4 — Implement `StyleMemoHistoryTimeline` (server)**

```tsx
// app/(authenticated)/[orgId]/reports/performance/settings/style-memo-history-timeline.tsx
import { createClient } from '@/lib/supabase/server'
import { formatQuarterLabel } from '@/lib/reviews/period'
import type { MemoHistoryRow } from '@/lib/reviews/narrative/memo-history-types'
import { StyleMemoHistoryRow } from './style-memo-history-row'

const MAX_ROWS = 50

interface Props {
  orgId: string
}

export async function StyleMemoHistoryTimeline({ orgId }: Props) {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('marketing_review_style_memo_versions')
    .select('id, organization_id, snapshot_id, memo, rationale, source, created_by, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  const list = (rows ?? []) as Array<{
    id: string
    organization_id: string
    snapshot_id: string | null
    memo: string
    rationale: string | null
    source: 'auto' | 'manual'
    created_by: string | null
    created_at: string
  }>

  const snapshotIds = Array.from(new Set(list.map((r) => r.snapshot_id).filter((v): v is string => !!v)))
  const creatorIds = Array.from(new Set(list.map((r) => r.created_by).filter((v): v is string => !!v)))

  const [snapshotsRes, creatorsRes] = await Promise.all([
    snapshotIds.length
      ? supabase
          .from('marketing_review_snapshots')
          .select('id, review_id, marketing_reviews!inner(quarter)')
          .in('id', snapshotIds)
      : Promise.resolve({ data: [] as [] }),
    creatorIds.length
      ? supabase.from('users').select('id, first_name, last_name').in('id', creatorIds)
      : Promise.resolve({ data: [] as [] }),
  ])

  const snapshotMap = new Map(
    (snapshotsRes.data ?? []).map((s: any) => [
      s.id as string,
      {
        reviewId: s.review_id as string,
        quarter: Array.isArray(s.marketing_reviews)
          ? (s.marketing_reviews[0]?.quarter ?? null)
          : (s.marketing_reviews?.quarter ?? null),
      },
    ])
  )
  const creatorMap = new Map(
    (creatorsRes.data ?? []).map((u: any) => [
      u.id as string,
      [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
    ])
  )

  if (list.length === 0) {
    return (
      <section id="memo-history" data-testid="style-memo-history-timeline" className="space-y-3">
        <h3 className="text-sm font-medium">Memo history</h3>
        <p
          data-testid="style-memo-history-empty-state"
          className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
        >
          No history yet — publish a report or edit the memo to see learning events here.
        </p>
      </section>
    )
  }

  return (
    <section id="memo-history" data-testid="style-memo-history-timeline" className="space-y-3">
      <h3 className="text-sm font-medium">Memo history</h3>
      <div className="space-y-2">
        {list.map((r, index) => {
          const row: MemoHistoryRow = {
            id: r.id,
            organizationId: r.organization_id,
            snapshotId: r.snapshot_id,
            memo: r.memo,
            rationale: r.rationale,
            source: r.source,
            createdBy: r.created_by,
            createdAt: r.created_at,
          }
          const snap = r.snapshot_id ? snapshotMap.get(r.snapshot_id) : null
          const adminName = r.created_by ? (creatorMap.get(r.created_by) ?? null) : null
          return (
            <StyleMemoHistoryRow
              key={r.id}
              row={row}
              adminName={adminName}
              reviewId={snap?.reviewId ?? null}
              quarterLabel={snap ? formatQuarterLabel(snap.quarter ?? '') : null}
              orgId={orgId}
              index={index}
            />
          )
        })}
      </div>
    </section>
  )
}
```

**Step 5 — Mount on settings page**

In `app/(authenticated)/[orgId]/reports/performance/settings/page.tsx`, add below the `<StyleMemoCard>`:

```tsx
<StyleMemoHistoryTimeline orgId={orgId} />
```

Import at the top of the file.

**Step 6 — Run tests + build**

```bash
npx vitest tests/unit/app/authenticated/reports/performance/style-memo-history-timeline.test.tsx
RESEND_API_KEY=stub RESEND_FROM_EMAIL=stub@example.com npm run build 2>&1 | tail -5
```

Expected: tests pass, build succeeds.

**Step 7 — Commit**

```bash
git add app/\(authenticated\)/\[orgId\]/reports/performance/settings/style-memo-history-timeline.tsx \
        app/\(authenticated\)/\[orgId\]/reports/performance/settings/style-memo-history-row.tsx \
        app/\(authenticated\)/\[orgId\]/reports/performance/settings/page.tsx \
        tests/unit/app/authenticated/reports/performance/style-memo-history-timeline.test.tsx
git commit -m "feat(reviews): settings-side memo history timeline"
```

---

### Task 9: Seed + fixture updates

**Files:**

- Modify: `tests/fixtures/index.ts` — add `testStyleMemoVersions` fixture (array of versions for the seeded org).
- Modify: `tests/helpers/seed.ts` — insert the version rows alongside the existing memo singleton.

**What to build**

Add fixtures for:

1. One auto version row tied to the seeded published snapshot (`testMarketingReview.snapshotId`), with a rationale.
2. One manual version row (no snapshot, created_by = admin user).

Seed both rows idempotently via `upsert(..., { onConflict: 'id' })` so E2E runs stay deterministic.

**Step 1 — Add the fixtures**

In `tests/fixtures/index.ts`:

```ts
/**
 * Seeded memo history rows. Ensures the settings timeline and snapshot-detail
 * callout have content to render without having to trigger the live learner.
 */
export const testStyleMemoVersions = {
  auto: {
    id: '33333333-3333-4333-8333-333333333333',
    snapshotId: testMarketingReview.snapshotId,
    memo: testStyleMemo.memo,
    rationale: 'Noticed author prefers punchy bullets; leaned into that.',
    source: 'auto' as const,
    createdBy: null,
    createdAt: '2026-01-15T12:00:00Z',
  },
  manual: {
    id: '44444444-4444-4444-8444-444444444444',
    snapshotId: null,
    memo: testStyleMemo.memo + ' Also emphasise YoY deltas.',
    rationale: null,
    source: 'manual' as const,
    createdBy: null, // filled in by seed.ts with the admin user id
    createdAt: '2026-01-20T12:00:00Z',
  },
}
```

**Step 2 — Insert in seed.ts**

After the existing memo singleton upsert, add version row inserts with the admin user id wired into `createdBy` for the manual one.

**Step 3 — Re-seed + run**

```bash
npm run test:seed
```

Expected: no errors, seed reports both version rows written.

**Step 4 — Commit**

```bash
git add tests/fixtures/index.ts tests/helpers/seed.ts
git commit -m "test(reviews): seed memo history versions for E2E"
```

---

### Task 10: E2E + visual coverage

**Files:**

- Modify: `tests/e2e/performance-reports.spec.ts` — add three new tests.
- Modify: `tests/e2e/visual.spec.ts` — one new visual test.

**What to build**

**E2E tests:**

1. **Snapshot callout appears and links to settings.** Admin navigates to the seeded snapshot detail page. The `snapshot-learner-callout` testid is visible, the rationale text is present, and _"View full history"_ links to the settings `#memo-history` anchor.
2. **Settings timeline renders seeded rows.** Admin navigates to `/{orgId}/reports/performance/settings`, scrolls to `style-memo-history-timeline`, sees at least two rows (auto + manual). Clicks the expand toggle on row 0 and verifies the memo text becomes visible.
3. **Public share route does NOT render the callout.** Navigate to `/s/{testMarketingReview.publicShareToken}`. The public page must NOT contain the `snapshot-learner-callout` testid.

**Visual test (`tests/e2e/visual.spec.ts`):**

Add one snapshot test that navigates to the snapshot detail page, waits for both `review-deck` and `snapshot-learner-callout`, and takes `performance-report-snapshot-with-callout.png` full-page. Commit the `chromium-darwin` baseline alongside the test; CI will generate the `chromium-linux` baseline automatically on first run.

**Step 1 — Write the tests** (modelled on existing tests in both files)

**Step 2 — Run them**

```bash
npx playwright test tests/e2e/performance-reports.spec.ts
npx playwright test tests/e2e/visual.spec.ts --update-snapshots
```

First command: all three new tests pass. Second command: writes the new `chromium-darwin` baseline.

**Step 3 — Inspect the new baseline image**

Open `tests/e2e/visual.spec.ts-snapshots/performance-report-snapshot-with-callout-chromium-darwin.png` and verify it looks correct (deck visible, callout visible below).

**Step 4 — Commit**

```bash
git add tests/e2e/performance-reports.spec.ts tests/e2e/visual.spec.ts \
        tests/e2e/visual.spec.ts-snapshots/performance-report-snapshot-with-callout-chromium-darwin.png
git commit -m "test(reviews): e2e + visual coverage for memo history surfaces"
```

---

## Final verification (before opening PR)

```bash
npm run lint && npm run test:unit && RESEND_API_KEY=stub RESEND_FROM_EMAIL=stub@example.com npm run build
```

All three must pass. Then push:

```bash
git push -u origin feature/memo-history
```

Open the PR:

```bash
gh pr create --title "feat(reviews): memo history and rationale" --body "$(cat <<'EOF'
## Summary

- New `marketing_review_style_memo_versions` table (append-only) records every memo state.
- Learner emits a rationale sentence alongside the memo via `generateObject`.
- Snapshot detail page shows _"What the AI learned from this report"_ callout.
- Settings page shows the full memo history timeline (auto + manual events).
- Hidden on public share route.

## Test plan

- [ ] Unit tests pass
- [ ] Integration tests pass (RLS coverage)
- [ ] E2E tests pass locally
- [ ] Visual snapshot generated and committed
- [ ] CI green

Design: `docs/plans/2026-04-22-memo-history-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notes for the executor

- **Always work in `.worktrees/memo-history`.** Never edit the main checkout directly.
- **After each task**, run the relevant test command shown in the task's final step — not just the new tests, but the whole affected file. A passing task should not break any neighbour.
- **TDD strictly.** Write the failing test first, watch it fail, then implement. If a test passes before you implement, the test is wrong.
- **Reference the design doc** (`docs/plans/2026-04-22-memo-history-design.md`) whenever a decision isn't explicit in this plan.
- **Do not change the existing style-memo feature shape.** The public API of `runStyleMemoLearner`, `saveStyleMemo`, etc. is stable — extend their result types but don't rename or remove existing fields.
- **Prettier + ESLint** run in CI; if either complains locally, fix before committing.
