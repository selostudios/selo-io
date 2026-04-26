# LinkedIn Top Posts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "What Resonated" slide to the quarterly performance report that surfaces the top 4 LinkedIn organization posts by engagement rate, backed by a daily-synced `linkedin_posts` table and a private Supabase Storage bucket of thumbnails.

**Architecture:** New `linkedin_posts` table (RLS-isolated per org, upserted by `linkedin_urn`) populated daily by a new `syncLinkedInPosts(connection)` action invoked from the existing `daily-metrics-sync` cron after the standard LinkedIn metrics sync. Thumbnails download to a private `linkedin-post-thumbnails` bucket; the reviews fetcher mints 1-year signed URLs at read time. The narrative layer gains a new `content_highlights` block (with prompt, AI originals, and style-memo learner integration). `<ReviewDeck>` adds a `kind: 'content'` body section that maps to a new `<ContentBodySlide>` and is filtered out when there are no qualifying posts.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Storage + RLS), LinkedIn REST API version `202601`, Vercel AI SDK + Claude, Vitest, Playwright.

**Design reference:** `docs/plans/2026-04-24-linkedin-top-posts-design.md`

---

## Conventions

- **Worktree:** `.worktrees/linkedin-top-posts` on branch `feature/linkedin-top-posts`. Do not `cd` out.
- **TDD per task:** Write the failing test first, run it, watch it fail, write the minimal implementation, run it, watch it pass, commit. No batching.
- **Commits:** Small, scoped, Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`). One logical change per commit.
- **Before pushing:** `npm run lint && npm run test:unit && npm run build` from the worktree root. Stop and fix any failure.
- **Migrations:** Never edit existing migrations. Create new ones under `supabase/migrations/` with a UTC timestamp prefix. Verify locally via `supabase db reset`.
- **Test ids:** Every new component gets a kebab-case `data-testid` (e.g. `top-post-card`, `content-body-slide`).
- **Enums:** `post_type` is enforced as a CHECK constraint at the DB layer and a `LinkedInPostType` enum at the app layer.
- **Mocking:** When a unit test would otherwise hit the real LinkedIn CDN or Supabase, use `vi.spyOn(global, 'fetch')` and a hand-rolled chainable Supabase fake — see `tests/unit/platforms/linkedin/post-analytics.test.ts` for the established pattern.

---

## Task 1: Migration — `linkedin_posts` table

**Files:**

- Create: `supabase/migrations/20260424120000_linkedin_posts.sql`

**Step 1: Write the migration**

```sql
-- LinkedIn posts for the quarterly performance report "What Resonated" slide.
CREATE TABLE linkedin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform_connection_id uuid NOT NULL REFERENCES platform_connections(id) ON DELETE CASCADE,
  linkedin_urn text NOT NULL,
  posted_at timestamptz NOT NULL,
  caption text,
  post_url text,
  thumbnail_path text,
  post_type text NOT NULL CHECK (post_type IN ('image', 'video', 'text', 'article', 'poll')),
  impressions integer NOT NULL DEFAULT 0,
  reactions integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  engagement_rate numeric,
  analytics_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX linkedin_posts_org_urn_key
  ON linkedin_posts(organization_id, linkedin_urn);
CREATE INDEX linkedin_posts_org_posted_at_idx
  ON linkedin_posts(organization_id, posted_at DESC);

ALTER TABLE linkedin_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_posts_select_team_members" ON linkedin_posts
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM team_members WHERE user_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_internal_user())
  );

GRANT SELECT ON public.linkedin_posts TO authenticated;
```

No INSERT/UPDATE/DELETE policies — writes go through the service client.

**Step 2: Reset local Supabase**

Run: `supabase db reset`
Expected: migration applies with no errors. `\d linkedin_posts` shows columns + indexes.

**Step 3: Commit**

```bash
git add supabase/migrations/20260424120000_linkedin_posts.sql
git commit -m "feat(db): add linkedin_posts table with RLS"
```

---

## Task 2: Migration — `linkedin-post-thumbnails` storage bucket

**Files:**

- Create: `supabase/migrations/20260424120100_linkedin_post_thumbnails_bucket.sql`

**Step 1: Write the migration**

```sql
-- Private bucket for LinkedIn post thumbnails.
-- Path pattern: {organization_id}/{linkedin_urn}.jpg
INSERT INTO storage.buckets (id, name, public)
VALUES ('linkedin-post-thumbnails', 'linkedin-post-thumbnails', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "linkedin_post_thumbnails_select_team_members"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'linkedin-post-thumbnails'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      (storage.foldername(name))[1]::uuid IN (
        SELECT organization_id FROM team_members WHERE user_id = (SELECT auth.uid())
      )
      OR (SELECT public.is_internal_user())
    )
  );
```

**Step 2: Reset + verify**

Run: `supabase db reset`. Confirm bucket exists in Studio (or via `psql`) and policy is attached.

**Step 3: Commit**

```bash
git add supabase/migrations/20260424120100_linkedin_post_thumbnails_bucket.sql
git commit -m "feat(db): add linkedin-post-thumbnails storage bucket with RLS"
```

---

## Task 3: `LinkedInPostType` enum + row interface

**Files:**

- Create: `lib/platforms/linkedin/post-types.ts`
- Create: `tests/unit/platforms/linkedin/post-types.test.ts`

**Step 1: Failing test**

```ts
import { describe, test, expect } from 'vitest'
import { LinkedInPostType, isLinkedInPostType } from '@/lib/platforms/linkedin/post-types'

describe('isLinkedInPostType', () => {
  test('accepts every value from the enum', () => {
    for (const v of Object.values(LinkedInPostType)) {
      expect(isLinkedInPostType(v)).toBe(true)
    }
  })
  test('rejects values outside the enum', () => {
    expect(isLinkedInPostType('document')).toBe(false)
    expect(isLinkedInPostType('')).toBe(false)
  })
})
```

Run: `npx vitest tests/unit/platforms/linkedin/post-types.test.ts` — FAIL.

**Step 2: Implementation**

```ts
export enum LinkedInPostType {
  Image = 'image',
  Video = 'video',
  Text = 'text',
  Article = 'article',
  Poll = 'poll',
}
const VALID = new Set<string>(Object.values(LinkedInPostType))
export function isLinkedInPostType(value: string): value is LinkedInPostType {
  return VALID.has(value)
}

export interface LinkedInPostRow {
  id: string
  organization_id: string
  platform_connection_id: string
  linkedin_urn: string
  posted_at: string
  caption: string | null
  post_url: string | null
  thumbnail_path: string | null
  post_type: LinkedInPostType
  impressions: number
  reactions: number
  comments: number
  shares: number
  engagement_rate: number | null
  analytics_updated_at: string | null
  created_at: string
}
```

Run tests — PASS.

**Step 3: Commit**

```bash
git add lib/platforms/linkedin/post-types.ts tests/unit/platforms/linkedin/post-types.test.ts
git commit -m "feat(linkedin): add LinkedInPostType enum and row interface"
```

---

## Task 4: `classifyPost` helper

Pure synchronous classifier from a raw `/posts` element to `{ postType, caption, postUrl, imageUrn }`.

**Files:**

- Create: `lib/platforms/linkedin/classify-post.ts`
- Create: `tests/unit/platforms/linkedin/classify-post.test.ts`

**Step 1: Failing tests**

Cover every branch:

- `multiImage.images[0].id` present → `Image`, `imageUrn` set
- `media.id` is `urn:li:video:…` → `Video`, no imageUrn
- `media.id` is `urn:li:image:…` → `Image`, imageUrn set
- `content.article` → `Article`, no imageUrn
- `content.poll` → `Poll`
- otherwise → `Text`
- empty/whitespace `commentary` → `caption: null`
- `postUrl` is `https://www.linkedin.com/feed/update/{id}`

Run: FAIL.

**Step 2: Implementation**

```ts
import type { LinkedInRawPost } from './client'
import { LinkedInPostType } from './post-types'

export interface ClassifiedPost {
  postType: LinkedInPostType
  caption: string | null
  postUrl: string
  imageUrn: string | null
}

export function classifyPost(raw: LinkedInRawPost): ClassifiedPost {
  const content = raw.content
  let postType: LinkedInPostType
  let imageUrn: string | null = null

  const multiImages = content?.multiImage?.images
  const mediaId = content?.media?.id

  if (multiImages && multiImages.length > 0) {
    postType = LinkedInPostType.Image
    imageUrn = multiImages[0]?.id ?? null
  } else if (mediaId) {
    if (mediaId.startsWith('urn:li:video:')) {
      postType = LinkedInPostType.Video
    } else {
      postType = LinkedInPostType.Image
      imageUrn = mediaId
    }
  } else if (content?.article) {
    postType = LinkedInPostType.Article
  } else if (content?.poll) {
    postType = LinkedInPostType.Poll
  } else {
    postType = LinkedInPostType.Text
  }

  const trimmed = raw.commentary?.trim()
  return {
    postType,
    caption: trimmed ? trimmed : null,
    postUrl: `https://www.linkedin.com/feed/update/${raw.id}`,
    imageUrn,
  }
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(linkedin): classify raw posts into normalised shape"
```

---

## Task 5: `computeEngagementRate`

**Files:**

- Create: `lib/platforms/linkedin/engagement.ts`
- Create: `tests/unit/platforms/linkedin/engagement.test.ts`

**Step 1: Failing tests**

```ts
test('returns null when impressions is 0', () => {
  expect(computeEngagementRate({ reactions: 5, comments: 0, shares: 0, impressions: 0 })).toBeNull()
})
test('returns engagements / impressions', () => {
  expect(
    computeEngagementRate({ reactions: 50, comments: 10, shares: 5, impressions: 1000 })
  ).toBeCloseTo(0.065)
})
test('treats missing reactions/comments/shares as 0', () => {
  expect(computeEngagementRate({ impressions: 100 })).toBe(0)
})
```

Run: FAIL.

**Step 2: Implementation**

```ts
export interface EngagementInput {
  reactions?: number
  comments?: number
  shares?: number
  impressions: number
}
export function computeEngagementRate(input: EngagementInput): number | null {
  if (!input.impressions || input.impressions <= 0) return null
  const engagements = (input.reactions ?? 0) + (input.comments ?? 0) + (input.shares ?? 0)
  return engagements / input.impressions
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(linkedin): add engagement-rate helper"
```

---

## Task 6: `LinkedInClient.listPosts`

Paginated fetch of `/posts?author={orgUrn}&q=author&count=50` filtered by `createdAt` since-date.

**Files:**

- Modify: `lib/platforms/linkedin/client.ts`
- Create: `tests/unit/platforms/linkedin/list-posts.test.ts`

**Step 1: Failing tests**

Mock `global.fetch` (mirror `tests/unit/platforms/linkedin/post-analytics.test.ts`):

- Returns posts whose `createdAt` is in `[since, now]`.
- Drops posts older than `since`; stops paginating once an older post is seen on a page.
- Skips posts missing `createdAt` without breaking pagination.
- Follows the `paging.links.next` link cursor; falls back to `start += elements.length` when paging metadata is incomplete.
- Caps at `maxPages` (default 10).

Run: FAIL.

**Step 2: Implementation**

Add to `lib/platforms/linkedin/client.ts`:

```ts
export interface LinkedInRawPost {
  id: string
  createdAt: number | undefined
  commentary?: string
  contentType?: string
  content?: {
    media?: { id?: string; altText?: string }
    article?: { thumbnail?: string; source?: string; title?: string }
    poll?: unknown
    multiImage?: { images?: Array<{ id?: string }> }
  }
  lifecycleState?: string
}

export interface ListPostsOptions {
  orgUrn: string
  since: Date
  maxPages?: number
}

// inside class LinkedInClient:
async listPosts(opts: ListPostsOptions): Promise<LinkedInRawPost[]> {
  const maxPages = opts.maxPages ?? 10
  const sinceMs = opts.since.getTime()
  const nowMs = Date.now()
  const posts: LinkedInRawPost[] = []
  let start = 0
  let pages = 0
  while (pages < maxPages) {
    const data = await this.fetch<{
      elements: LinkedInRawPost[]
      paging?: { start?: number; count?: number; links?: Array<{ rel: string; href: string }> }
    }>(`/posts?author=${encodeURIComponent(opts.orgUrn)}&q=author&count=50&start=${start}`)
    const elements = data.elements ?? []
    if (elements.length === 0) break
    let sawOlder = false
    for (const post of elements) {
      if (typeof post.createdAt !== 'number') continue
      if (post.createdAt >= sinceMs && post.createdAt <= nowMs) posts.push(post)
      else if (post.createdAt < sinceMs) sawOlder = true
    }
    if (sawOlder) break
    const next = data.paging?.links?.find((l) => l.rel === 'next')
    if (!next) break
    const pagingStart = data.paging?.start
    const pagingCount = data.paging?.count
    start = typeof pagingStart === 'number'
      ? pagingStart + (typeof pagingCount === 'number' ? pagingCount : elements.length)
      : start + elements.length
    pages++
  }
  return posts
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(linkedin): list organisation posts via REST API"
```

---

## Task 7: `LinkedInClient.resolveImageUrl`

Resolve `urn:li:image:…` → CDN download URL via `GET /images/{urn}`.

**Files:**

- Modify: `lib/platforms/linkedin/client.ts`
- Create: `tests/unit/platforms/linkedin/resolve-image.test.ts`

**Step 1: Failing tests**

- Returns `data.downloadUrl` when present.
- Returns `null` when LinkedIn omits `downloadUrl`.
- URL-encodes the `imageUrn` path segment.

Run: FAIL.

**Step 2: Implementation**

```ts
async resolveImageUrl(imageUrn: string): Promise<string | null> {
  const data = await this.fetch<{ id?: string; downloadUrl?: string }>(
    `/images/${encodeURIComponent(imageUrn)}`
  )
  return data.downloadUrl ?? null
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(linkedin): resolve image URN to CDN download URL"
```

---

## Task 8: `LinkedInClient.getPostAnalytics`

> **Note:** The Restli `List(...)` syntax for `/organizationalEntityShareStatistics` already shipped on `main` via PR #33. Tests live in `tests/unit/platforms/linkedin/post-analytics.test.ts`. **No work required for this task** — verify with `npx vitest tests/unit/platforms/linkedin/post-analytics.test.ts` and confirm all 7 tests pass.

If for some reason the method is missing on this branch, restore from `main`:

```bash
git show main:lib/platforms/linkedin/client.ts > /tmp/main-client.ts
# manually re-introduce the getPostAnalytics block
```

---

## Task 9: `downloadThumbnails` helper

Bounded-concurrency downloader → `linkedin-post-thumbnails/{org}/{urn}.jpg`.

**Files:**

- Create: `lib/platforms/linkedin/download-thumbnails.ts`
- Create: `tests/unit/platforms/linkedin/download-thumbnails.test.ts`

**Step 1: Failing tests**

- Returns empty map when `jobs` is empty (no fetch calls).
- Uploads each successful download to `{organizationId}/{linkedin_urn}.jpg` with `contentType: 'image/jpeg'` + `upsert: true`.
- Returns map keyed by `linkedin_urn` → `thumbnail_path` only for successful uploads.
- Logs and skips when `fetch` returns non-OK; never throws.
- Logs and skips when storage upload errors; never throws.
- Runs at most 5 workers in parallel (assert by counting concurrent in-flight fetches via a probe).

Mock `global.fetch`. Mock the Supabase storage client with `vi.fn()`.

Run: FAIL.

**Step 2: Implementation**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'linkedin-post-thumbnails'
const CONCURRENCY = 5

export interface ThumbnailJob {
  organizationId: string
  linkedinUrn: string
  imageCdnUrl: string
}

export async function downloadThumbnails(
  supabase: SupabaseClient,
  jobs: ThumbnailJob[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (jobs.length === 0) return out
  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break
      try {
        const res = await fetch(job.imageCdnUrl)
        if (!res.ok) continue
        const buf = new Uint8Array(await res.arrayBuffer())
        const path = `${job.organizationId}/${job.linkedinUrn}.jpg`
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, buf, { contentType: 'image/jpeg', upsert: true })
        if (!error) out.set(job.linkedinUrn, path)
      } catch (err) {
        console.error('[LinkedIn Thumbnail] download failed', {
          type: 'thumbnail_download_error',
          linkedinUrn: job.linkedinUrn,
          error: err instanceof Error ? err.message : 'unknown',
          timestamp: new Date().toISOString(),
        })
      }
    }
  })
  await Promise.all(workers)
  return out
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(linkedin): download thumbnails to storage with concurrency cap"
```

---

## Task 10: `syncLinkedInPosts` orchestrator

Pipeline: `listPosts (95-day window) → upsert → query just-upserted rows → fetch analytics → update counters + engagement_rate → resolve + download thumbnails for image posts missing a stored thumbnail`. Wraps the whole thing in `try/catch` so one org's failure can't halt the cron.

**Files:**

- Modify: `lib/platforms/linkedin/actions.ts`
- Create: `tests/unit/platforms/linkedin/sync-posts.test.ts`

**Step 1: Failing tests**

- Returns early (no DB writes) when `listPosts` returns empty.
- Upserts rows with `onConflict: 'organization_id,linkedin_urn'` containing `caption`, `post_url`, `post_type`, `posted_at`.
- After upsert, queries the table for posts within the last 90 days that match the just-upserted urns; calls `getPostAnalytics` for those urns only.
- Updates `impressions/reactions/comments/shares/engagement_rate/analytics_updated_at` from analytics map; rows with no analytics are skipped.
- For image-type rows with `thumbnail_path == null`, calls `resolveImageUrl(imageUrn)` then queues a `ThumbnailJob`. Skips when `imageUrn` or `cdnUrl` is missing.
- After `downloadThumbnails`, updates `thumbnail_path` for each successful upload.
- Logs (does not throw) on upsert error / analytics error / thumbnail update error.
- Top-level `try/catch` swallows + logs `posts_sync_error`.

Use a hand-rolled fake Supabase client (object literal returning chainable `from().upsert()`, `from().select().eq().gte().in()`, `from().update().match()`, `storage.from().upload()`). Mock `LinkedInClient` methods with `vi.spyOn`.

Run: FAIL.

**Step 2: Implementation**

Append to `lib/platforms/linkedin/actions.ts`:

```ts
export async function syncLinkedInPosts(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const credentials = getCredentials(storedCredentials)
    const client = new LinkedInClient(credentials, connectionId, supabase)
    const since = new Date(Date.now() - 95 * 86_400_000)
    const orgUrn = `urn:li:organization:${credentials.organization_id}`

    const rawPosts = await client.listPosts({ orgUrn, since })
    const classifiedByUrn = new Map<string, ReturnType<typeof classifyPost>>()
    const rows: Array<Record<string, unknown>> = []
    for (const raw of rawPosts) {
      if (typeof raw.createdAt !== 'number') continue
      const classified = classifyPost(raw)
      classifiedByUrn.set(raw.id, classified)
      rows.push({
        organization_id: organizationId,
        platform_connection_id: connectionId,
        linkedin_urn: raw.id,
        posted_at: new Date(raw.createdAt).toISOString(),
        caption: classified.caption,
        post_url: classified.postUrl,
        post_type: classified.postType,
      })
    }
    if (rows.length === 0) return

    const { error: upsertError } = await supabase
      .from('linkedin_posts')
      .upsert(rows, { onConflict: 'organization_id,linkedin_urn' })
    if (upsertError) {
      /* log + return */
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const justUpsertedUrns = rows.map((r) => r.linkedin_urn as string)
    const { data: analyticsRows } = await supabase
      .from('linkedin_posts')
      .select('linkedin_urn, posted_at, post_type, thumbnail_path')
      .eq('organization_id', organizationId)
      .gte('posted_at', ninetyDaysAgo)
      .in('linkedin_urn', justUpsertedUrns)

    const analyticsRowList = analyticsRows ?? []
    const urns = analyticsRowList.map((r) => r.linkedin_urn)
    const analytics = urns.length > 0 ? await client.getPostAnalytics(urns) : new Map()

    const analyticsUpdatedAt = new Date().toISOString()
    await Promise.all(
      analyticsRowList.map(async (row) => {
        const counters = analytics.get(row.linkedin_urn)
        if (!counters) return
        const engagementRate = computeEngagementRate(counters)
        await supabase
          .from('linkedin_posts')
          .update({
            impressions: counters.impressions,
            reactions: counters.reactions,
            comments: counters.comments,
            shares: counters.shares,
            engagement_rate: engagementRate,
            analytics_updated_at: analyticsUpdatedAt,
          })
          .match({ organization_id: organizationId, linkedin_urn: row.linkedin_urn })
      })
    )

    const thumbnailJobs: ThumbnailJob[] = []
    for (const row of analyticsRowList.filter(
      (r) => r.post_type === LinkedInPostType.Image && r.thumbnail_path == null
    )) {
      const imageUrn = classifiedByUrn.get(row.linkedin_urn)?.imageUrn ?? null
      if (!imageUrn) continue
      const cdnUrl = await client.resolveImageUrl(imageUrn)
      if (!cdnUrl) continue
      thumbnailJobs.push({ organizationId, linkedinUrn: row.linkedin_urn, imageCdnUrl: cdnUrl })
    }
    if (thumbnailJobs.length > 0) {
      const thumbMap = await downloadThumbnails(supabase, thumbnailJobs)
      await Promise.all(
        Array.from(thumbMap).map(async ([linkedinUrn, path]) => {
          await supabase
            .from('linkedin_posts')
            .update({ thumbnail_path: path })
            .match({ organization_id: organizationId, linkedin_urn: linkedinUrn })
        })
      )
    }
  } catch (error) {
    console.error('[LinkedIn Posts Sync] Error', {
      type: 'posts_sync_error',
      connectionId,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
  }
}
```

Add the necessary imports (`classifyPost`, `computeEngagementRate`, `downloadThumbnails`, `LinkedInPostType`, `ThumbnailJob`).

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(linkedin): sync org posts into linkedin_posts table"
```

---

## Task 11: Wire `syncLinkedInPosts` into the daily cron

**Files:**

- Modify: `app/api/cron/daily-metrics-sync/route.ts`

**Step 1: Edit the route**

In the `linkedin` case of the `switch` inside `syncConnection`, **after** `syncMetricsForLinkedInConnection(...)` resolves, call `syncLinkedInPosts(...)` — but skip during `isBackfill` runs (top-posts data is "live", not historical):

```ts
case 'linkedin':
  await syncMetricsForLinkedInConnection(
    connection.id,
    connection.organization_id,
    connection.credentials,
    supabase,
    targetDate
  )
  if (!isBackfill) {
    try {
      await syncLinkedInPosts(
        connection.id,
        connection.organization_id,
        connection.credentials,
        supabase
      )
    } catch (err) {
      console.error('[Cron Error]', {
        type: 'sync_linkedin_posts_failed',
        connectionId: connection.id,
        error: err instanceof Error ? err.message : 'unknown',
        timestamp: new Date().toISOString(),
      })
    }
  }
  break
```

Add `syncLinkedInPosts` to the existing top-of-file import group.

**Step 2: Smoke test**

Run: `npm run test:unit` — existing cron tests should still pass.
Run: `npm run build` — must compile.

**Step 3: Commit**

```bash
git add app/api/cron/daily-metrics-sync/route.ts
git commit -m "feat(cron): sync LinkedIn posts after daily metrics sync"
```

---

## Task 12: Reviews types — `content_highlights`, `top_posts`, `LinkedInTopPost`

**Files:**

- Modify: `lib/reviews/types.ts`

**Step 1: Edit**

Add to `NarrativeBlocks`:

```ts
export interface NarrativeBlocks {
  // … existing keys …
  content_highlights?: string
}
```

Add to `LinkedInData`:

```ts
top_posts?: LinkedInTopPost[]
```

Add the new type:

```ts
export interface LinkedInTopPost {
  id: string
  url: string | null
  thumbnail_url: string | null
  caption: string | null
  posted_at: string
  impressions: number
  reactions: number
  comments: number
  shares: number
  engagement_rate: number
}
```

**Step 2: Build**

Run: `npm run build` — must compile.

**Step 3: Commit**

```bash
git add lib/reviews/types.ts
git commit -m "feat(reviews): add LinkedInTopPost + content_highlights to narrative types"
```

---

## Task 13: Narrative prompt — `content_highlights`

**Files:**

- Modify: `lib/reviews/narrative/prompts.ts`
- Modify (or create): `tests/unit/lib/reviews/narrative/prompts.test.ts`

**Step 1: Failing tests**

- `NARRATIVE_BLOCK_KEYS` includes `'content_highlights'`.
- `defaultTemplates.content_highlights` is defined.
- `contentHighlightsPrompt(ctx)` includes the org name, the quarter, and the compact `top_posts` payload (assert by checking for the first post's URN substring in the rendered prompt).

Run: FAIL.

**Step 2: Implementation**

In `prompts.ts`:

- Append `'content_highlights'` to `NARRATIVE_BLOCK_KEYS`.
- Add `defaultTemplateContentHighlights()` returning the design-doc copy ("The 'What Resonated' slide shows the four LinkedIn posts with the highest engagement rate this quarter…"). Cover the "fewer than 2 posts" and "no posts" fallback wording.
- Register it in `defaultTemplates`.
- Export `contentHighlightsPrompt(ctx, template?)` that wraps `resolve(template, defaultTemplateContentHighlights())`.

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): add content_highlights narrative block"
```

---

## Task 14: Compact serializer — `top_posts` in prompt context

**Files:**

- Modify: `lib/reviews/narrative/context.ts`
- Modify (or create): `tests/unit/lib/reviews/narrative/context.test.ts`

**Step 1: Failing tests**

- `compactTopPost(post)` keeps only the fields the model needs (URN, caption truncated to ≤140 chars with ellipsis, engagement_rate to 4 dp, impressions, total engagements).
- `buildPromptContextPayload(data)` includes `top_posts` only when `data.linkedin?.top_posts` is non-empty (omits the key entirely otherwise).

Run: FAIL.

**Step 2: Implementation**

```ts
export interface CompactLinkedInTopPost {
  id: string
  caption: string | null
  engagement_rate: number
  impressions: number
  engagements: number
}
function compactTopPost(post: LinkedInTopPost): CompactLinkedInTopPost {
  const trimmed = post.caption?.trim() ?? null
  const caption = trimmed && trimmed.length > 140 ? trimmed.slice(0, 137) + '…' : trimmed
  return {
    id: post.id,
    caption,
    engagement_rate: Math.round(post.engagement_rate * 10000) / 10000,
    impressions: post.impressions,
    engagements: post.reactions + post.comments + post.shares,
  }
}
```

Wire into `buildPromptContextPayload` only when `top_posts` is non-empty.

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): compact top posts for narrative prompts"
```

---

## Task 15: Generator — schema + master prompt

**Files:**

- Modify: `lib/reviews/narrative/generator.ts`
- Modify: `tests/unit/lib/reviews/narrative/generator.test.ts`

**Step 1: Failing tests**

- Zod schema includes `content_highlights: z.string()`.
- Master prompt includes a `=== Block: content_highlights ===` section between `linkedin_insights` and `initiatives`.
- The leading sentence reads "seven narrative blocks", not six.

Run: FAIL.

**Step 2: Implementation**

```ts
const NarrativeSchema = z.object({
  cover_subtitle: z.string().max(200),
  ga_summary: z.string(),
  linkedin_insights: z.string(),
  content_highlights: z.string(),
  initiatives: z.string(),
  takeaways: z.string(),
  planning: z.string(),
})
```

Add `contentHighlightsPrompt` to the imports and to `buildMasterPrompt`:

```ts
'=== Block: linkedin_insights ===',
linkedinInsightsPrompt(ctx, overrides.linkedin_insights),
'',
'=== Block: content_highlights ===',
contentHighlightsPrompt(ctx, overrides.content_highlights),
'',
'=== Block: initiatives ===',
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): generate content_highlights block"
```

---

## Task 16: Style-memo learner picks up `content_highlights`

The learner reads `NARRATIVE_BLOCK_KEYS` directly via `style-memo-shared.ts::buildLearnerDiff`. Adding the key in Task 13 already wires it through.

**Files:**

- Modify: `tests/unit/lib/reviews/narrative/style-memo.test.ts`

**Step 1: Failing test**

When `narrative.content_highlights` differs from `ai_originals.content_highlights`, `buildLearnerDiff` includes the block in its output.

Run: FAIL (because there's no fixture yet).

**Step 2: Wire up the fixture**

No source code change — confirm the test passes against the existing learner once the new block key is in `NARRATIVE_BLOCK_KEYS`.

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "test(reviews): confirm content_highlights flows through style-memo learner"
```

---

## Task 17: Reviews fetcher — populate `top_posts`

**Files:**

- Modify: `lib/reviews/fetchers/linkedin.ts`
- Modify: `tests/unit/lib/reviews/fetchers/linkedin.test.ts`

**Step 1: Failing tests**

Mock the Supabase service client. Assert:

- Query selects from `linkedin_posts` filtered by `organization_id`, `posted_at` between `periods.main.start/end`, `engagement_rate not null`, ordered by `engagement_rate DESC`, limit 4.
- For rows with `thumbnail_path`, calls `storage.from('linkedin-post-thumbnails').createSignedUrl(path, 365 * 24 * 3600)`.
- Returns `top_posts: []` (with `metrics`) when the query errors — does not throw.
- Maps each row to a `LinkedInTopPost` with numeric coercion (`Number(row.impressions) || 0`, etc.).

Run: FAIL.

**Step 2: Implementation**

```ts
const THUMBNAIL_BUCKET = 'linkedin-post-thumbnails'
const THUMBNAIL_SIGNED_URL_TTL_SECONDS = 365 * 24 * 3600
const TOP_POSTS_LIMIT = 4

// after building `metrics` …
const { data: postRows, error: postsError } = await supabase
  .from('linkedin_posts')
  .select(
    'linkedin_urn, post_url, thumbnail_path, caption, posted_at, impressions, reactions, comments, shares, engagement_rate'
  )
  .eq('organization_id', organizationId)
  .gte('posted_at', periods.main.start)
  .lte('posted_at', periods.main.end)
  .not('engagement_rate', 'is', null)
  .order('engagement_rate', { ascending: false })
  .limit(TOP_POSTS_LIMIT)

if (postsError) {
  console.error('[Reviews] linkedin top posts query failed', {
    type: 'linkedin_top_posts_query_failed',
    organizationId,
    error: postsError.message,
    timestamp: new Date().toISOString(),
  })
  return { metrics, top_posts: [] }
}

const top_posts: LinkedInTopPost[] = await Promise.all(
  (postRows ?? []).map(async (row) => {
    let thumbnail_url: string | null = null
    if (row.thumbnail_path) {
      const { data: signed } = await supabase.storage
        .from(THUMBNAIL_BUCKET)
        .createSignedUrl(row.thumbnail_path, THUMBNAIL_SIGNED_URL_TTL_SECONDS)
      thumbnail_url = signed?.signedUrl ?? null
    }
    return {
      id: row.linkedin_urn,
      url: row.post_url,
      thumbnail_url,
      caption: row.caption,
      posted_at: row.posted_at,
      impressions: Number(row.impressions) || 0,
      reactions: Number(row.reactions) || 0,
      comments: Number(row.comments) || 0,
      shares: Number(row.shares) || 0,
      engagement_rate: Number(row.engagement_rate) || 0,
    }
  })
)

return { metrics, top_posts }
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): populate LinkedIn top_posts from linkedin_posts table"
```

---

## Task 18: `<TextPostPlaceholder>` component

Indigo→purple gradient matching the image aspect ratio, with a quote-mark SVG.

**Files:**

- Create: `components/reviews/review-deck/text-post-placeholder.tsx`
- Create: `tests/unit/components/reviews/review-deck/text-post-placeholder.test.tsx`

**Step 1: Failing test**

Renders an element with `data-testid="text-post-placeholder"` and an inline quote-mark SVG.

Run: FAIL.

**Step 2: Implementation**

```tsx
export function TextPostPlaceholder() {
  return (
    <div
      data-testid="text-post-placeholder"
      className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-12 w-12 text-white/80" fill="currentColor">
        <path d="M7.17 17q-1.31 0-2.24-.93Q4 15.13 4 13.83v-.66q0-2.39 1.62-4.42T9.5 6l1.5 1.5q-1.5.5-2.5 1.75T7.5 12h.67q1.3 0 2.24.92.92.93.92 2.24 0 1.3-.92 2.23-.93.93-2.24.93Zm9 0q-1.31 0-2.24-.93Q13 15.13 13 13.83v-.66q0-2.39 1.62-4.42T18.5 6l1.5 1.5q-1.5.5-2.5 1.75T16.5 12h.67q1.3 0 2.24.92.92.93.92 2.24 0 1.3-.92 2.23-.93.93-2.24.93Z" />
      </svg>
    </div>
  )
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): add TextPostPlaceholder component"
```

---

## Task 19: `<TopPostCard>` component

**Files:**

- Create: `components/reviews/review-deck/top-post-card.tsx`
- Create: `tests/unit/components/reviews/review-deck/top-post-card.test.tsx`

**Step 1: Failing tests**

- With a `thumbnail_url` → renders `<img>` with `src={thumbnail_url}`.
- Without a `thumbnail_url` → renders `<TextPostPlaceholder>`.
- Caption renders with `line-clamp-2` (assert via class presence).
- Engagement rate renders as `X.X%` (e.g. `0.065 → "6.5%"`).
- Impressions and total engagements use `toLocaleString()`.
- `<img onError>` swaps to `<TextPostPlaceholder>` (use React state).
- Wraps in `<a href={post.url}>` when `url` is non-null; renders plain `<div>` otherwise.
- Has `data-testid="top-post-card"`.

Run: FAIL.

**Step 2: Implementation**

```tsx
'use client'
import { useState } from 'react'
import { TextPostPlaceholder } from './text-post-placeholder'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export function TopPostCard({ post }: { post: LinkedInTopPost }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showPlaceholder = !post.thumbnail_url || imgFailed
  const engagements = post.reactions + post.comments + post.shares

  const card = (
    <div data-testid="top-post-card" className="flex flex-col gap-3">
      {showPlaceholder ? (
        <TextPostPlaceholder />
      ) : (
        <img
          src={post.thumbnail_url ?? undefined}
          alt=""
          className="aspect-[4/3] w-full rounded-lg object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      {post.caption && <p className="line-clamp-2 text-sm leading-snug">{post.caption}</p>}
      <div className="text-2xl font-semibold" style={{ color: 'var(--deck-accent)' }}>
        {(post.engagement_rate * 100).toFixed(1)}%
      </div>
      <div className="text-muted-foreground text-xs">
        {post.impressions.toLocaleString()} impressions · {engagements.toLocaleString()} engagements
      </div>
    </div>
  )

  return post.url ? (
    <a href={post.url} target="_blank" rel="noopener noreferrer" className="block">
      {card}
    </a>
  ) : (
    card
  )
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): add TopPostCard component"
```

---

## Task 20: `<TopPostGrid>` component

**Files:**

- Create: `components/reviews/review-deck/top-post-grid.tsx`
- Create: `tests/unit/components/reviews/review-deck/top-post-grid.test.tsx`

**Step 1: Failing tests**

- Renders 4 cards with 4 posts.
- Renders 2 cards centered (parent has `justify-center`) with 2 posts.
- Returns `null` with 0 posts.
- Has `data-testid="top-post-grid"`.

Run: FAIL.

**Step 2: Implementation**

```tsx
import { TopPostCard } from './top-post-card'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export function TopPostGrid({ posts }: { posts: LinkedInTopPost[] }) {
  if (posts.length === 0) return null
  return (
    <div data-testid="top-post-grid" className="flex flex-wrap justify-center gap-4 md:gap-6">
      {posts.map((post) => (
        <div key={post.id} className="w-full max-w-[260px] md:w-[260px]">
          <TopPostCard post={post} />
        </div>
      ))}
    </div>
  )
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): add TopPostGrid component"
```

---

## Task 21: `<ContentBodySlide>` component

**Files:**

- Create: `components/reviews/review-deck/content-body-slide.tsx`
- Create: `tests/unit/components/reviews/review-deck/content-body-slide.test.tsx`

**Step 1: Failing tests**

- Heading text "What Resonated".
- Renders `<TopPostGrid>` with the supplied posts.
- Renders `<SlideNarrative>` with the narrative text + `data-testid="content-body-slide-content"`.

Run: FAIL.

**Step 2: Implementation**

```tsx
import { TopPostGrid } from './top-post-grid'
import { SlideNarrative } from './slide-narrative'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface ContentBodySlideProps {
  narrative: string
  posts: LinkedInTopPost[]
  mode: 'screen' | 'print'
}

export function ContentBodySlide({ narrative, posts }: ContentBodySlideProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-8 py-12 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        What Resonated
      </h2>
      <TopPostGrid posts={posts} />
      <SlideNarrative text={narrative} testId="content-body-slide-content" />
    </div>
  )
}
```

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): add ContentBodySlide component"
```

---

## Task 22: Deck wiring — `kind: 'content'` body section

**Files:**

- Modify: `components/reviews/review-deck/index.tsx`
- Modify: `tests/unit/components/reviews/review-deck/review-deck.test.tsx`

**Step 1: Failing tests**

- With `data.linkedin.top_posts.length === 4`, the deck includes a slide with `aria-heading="What Resonated"` between LinkedIn and Initiatives.
- With `data.linkedin.top_posts` undefined or empty, the slide is **omitted** (slide count drops by 1).

Run: FAIL.

**Step 2: Implementation**

Extend the `BodySection` discriminated union to include the `content` variant, and update the default-case key union to include `content_highlights`:

```ts
type BodySection =
  | {
      key:
        | 'cover_subtitle'
        | 'ga_summary'
        | 'linkedin_insights'
        | 'content_highlights'
        | 'initiatives'
        | 'takeaways'
        | 'planning'
      heading: string
      kind: 'default'
    }
  | { key: 'ga_summary'; heading: string; kind: 'ga' }
  | { key: 'linkedin_insights'; heading: string; kind: 'linkedin' }
  | { key: 'content_highlights'; heading: string; kind: 'content' }
```

Insert into `BODY_SECTIONS` between `linkedin_insights` and `initiatives`:

```ts
{ key: 'content_highlights', heading: 'What Resonated', kind: 'content' },
```

In the slide-build loop, add the branch and `.filter` so `null` slides drop out:

```ts
if (section.kind === 'content') {
  const posts = data?.linkedin?.top_posts ?? []
  if (posts.length === 0) return null
  return {
    key: section.key,
    ariaHeading: section.heading,
    render: (mode: 'screen' | 'print') => (
      <ContentBodySlide narrative={text} posts={posts} mode={mode} />
    ),
  }
}
```

Followed by `.filter((s): s is BuiltSlide => s !== null)`.

Run: PASS.

**Step 3: Commit**

```bash
git commit -m "feat(reviews): render What Resonated slide conditionally"
```

---

## Task 23: Visual snapshots

**Files:**

- Modify: `tests/e2e/visual.spec.ts`
- Modify: seed helpers (`tests/helpers/seed.ts` and/or `tests/fixtures/index.ts`) to insert `linkedin_posts` rows for the seeded org's most recent quarter.

**Step 1: Edit**

Seed an org with 4 image posts (engagement rates 0.08, 0.07, 0.06, 0.05) all with `thumbnail_path` populated. Add a separate snapshot variant where only 2 posts exist (grid centered). Use placeholder images committed to the repo (or generate gradient PNGs at seed time) so screenshots are deterministic.

```ts
test('what resonated slide renders the top 4 posts', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`/${ORG_ID}/reports/performance/${REVIEW_ID}/preview`)
  // navigate to the What Resonated slide via aria-labeled next button
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /next slide/i }).click()
  await page.waitForSelector('[data-testid="top-post-grid"]')
  await expect(page).toHaveScreenshot('what-resonated-4-posts.png', { fullPage: true })
})
```

**Step 2: Generate baselines**

Run: `npm run test:e2e:update-snapshots -- tests/e2e/visual.spec.ts -g "what resonated"`
Eyeball the generated PNGs in `tests/e2e/visual.spec.ts-snapshots/`.

**Step 3: Commit**

```bash
git add tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots/what-resonated-*.png tests/helpers/seed.ts
git commit -m "test(e2e): visual snapshots for What Resonated slide"
```

---

## Task 24: Pre-push verification

**Step 1: Full check suite**

Run: `npm run lint && npm run test:unit && npm run build`
Expected: all three pass.

**Step 2: Visual E2E**

Run: `npx playwright test tests/e2e/visual.spec.ts`
Expected: PASS, no snapshot drift.

**Step 3: Diff review**

Run: `git diff main --stat`
Spot-check: no `console.log`, no leftover TODOs, no `.only()` or `.skip()` in tests.

---

## Task 25: Open the PR

```bash
git push -u origin feature/linkedin-top-posts
gh pr create --title "LinkedIn top posts: What Resonated slide" --body "$(cat <<'EOF'
## Summary
- New `linkedin_posts` table + `linkedin-post-thumbnails` storage bucket, synced daily by the existing `daily-metrics-sync` cron
- New "What Resonated" slide in the quarterly performance deck — top 4 LinkedIn posts by engagement rate
- New `content_highlights` narrative block with AI originals + style-memo learner integration
- Visual snapshots for the 4-post and 2-post variants

## Test plan
- [ ] `npm run lint && npm run test:unit && npm run build`
- [ ] `npx playwright test tests/e2e/visual.spec.ts`
- [ ] Manual: trigger `syncLinkedInPosts` against a staging org with LinkedIn connected; confirm thumbnails render, captions read well, engagement rates plausible
- [ ] Manual: preview a quarterly report for an org with real top-post data; advance to "What Resonated"; publish; confirm the public share link renders the slide

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After opening:

- Watch CI. If E2E / snapshot diffs fail, download the `snapshot-diffs` artifact and triage.
- Confirm the migrations apply cleanly in any Supabase preview branch.

---

## Out of scope (deferred)

- Top posts across multiple quarters / engagement trend chart
- User-pinned / user-overridden post lists
- Comment/reply content analysis
- Post scheduling or publishing
- Employee-advocacy / non-org-owned post analytics
