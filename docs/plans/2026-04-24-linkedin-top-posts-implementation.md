# LinkedIn Top Posts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "What Resonated" slide to the quarterly performance report that displays the top 4 LinkedIn posts by engagement rate, backed by a new daily-synced `linkedin_posts` table and thumbnails in Supabase Storage.

**Architecture:** New `linkedin_posts` table (RLS-isolated per org, upserted by `linkedin_urn`) synced daily from the LinkedIn REST API via a new `syncLinkedInPosts(connection)` function called from the existing daily cron. Thumbnails download to a private Supabase Storage bucket (`linkedin-post-thumbnails`) with 1-year signed URLs minted at read time. Narrative layer gets a new `content_highlights` block with its own prompt, AI originals, and style-memo learner integration. ReviewDeck gains a `kind: 'content'` body section that is filtered out when there are no qualifying posts.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Storage + RLS), LinkedIn REST API version 202601, Claude via Vercel AI SDK, Vitest, Playwright.

**Design reference:** `docs/plans/2026-04-24-linkedin-top-posts-design.md`

---

## Conventions

- **Work in the worktree:** `.worktrees/linkedin-top-posts` on branch `feature/linkedin-top-posts`. Do not `cd` out of it.
- **TDD:** For each task write a failing test first, verify it fails, then write the minimal implementation, verify it passes, then commit. No batching.
- **Commits:** Small, scoped commits per task. Use Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`).
- **Before pushing:** Always run `npm run lint && npm run test:unit && npm run build` from the worktree root. Stop and fix any failure.
- **Migrations:** Never hand-edit old migrations. Create new ones under `supabase/migrations/` with a UTC timestamp prefix. Test locally via `supabase db reset`.
- **Data testids:** Every new component gets a `data-testid` in kebab-case (`top-post-card`, `content-body-slide`, etc.).
- **Enums over strings:** `post_type` uses a CHECK constraint at the DB layer and a TS enum in `lib/enums.ts` at the app layer.
- **Keep diffs tight:** No tangential refactors. If you see something ugly, note it in a TODO comment and keep moving.

---

## Task 1: Create `linkedin_posts` table migration

**Files:**

- Create: `supabase/migrations/20260424120000_linkedin_posts.sql`

**Step 1: Write the migration**

```sql
-- LinkedIn posts for quarterly performance report "top posts" slide
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

-- Mirror the campaign_metrics RLS policy: members of the org can read.
CREATE POLICY "linkedin_posts_select_team_members" ON linkedin_posts
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM team_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users: the sync pipeline
-- uses the service client which bypasses RLS.
```

**Step 2: Reset local Supabase and verify it applies**

Run: `supabase db reset`
Expected: reset completes cleanly, no errors mentioning `linkedin_posts`.

**Step 3: Verify the table exists and shape is correct**

Run: `supabase db shell -c "\d linkedin_posts"`
Expected: all columns listed with correct types, indexes `linkedin_posts_org_urn_key` and `linkedin_posts_org_posted_at_idx` shown, RLS enabled.

**Step 4: Commit**

```bash
git add supabase/migrations/20260424120000_linkedin_posts.sql
git commit -m "feat(db): add linkedin_posts table for top-posts slide"
```

---

## Task 2: Create Supabase Storage bucket for thumbnails

**Files:**

- Create: `supabase/migrations/20260424120100_linkedin_post_thumbnails_bucket.sql`

**Step 1: Write the migration**

```sql
-- Private bucket for LinkedIn post thumbnails.
-- Path pattern: {organization_id}/{linkedin_urn}.jpg
INSERT INTO storage.buckets (id, name, public)
VALUES ('linkedin-post-thumbnails', 'linkedin-post-thumbnails', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated reads: only members of the owning org may read.
-- The first path segment is the organization_id.
CREATE POLICY "linkedin_post_thumbnails_select_team_members"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'linkedin-post-thumbnails'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM team_members WHERE user_id = (SELECT auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies: writes happen via service client.
```

**Step 2: Reset local Supabase**

Run: `supabase db reset`
Expected: reset completes cleanly.

**Step 3: Verify bucket exists**

Run: `supabase db shell -c "SELECT id, public FROM storage.buckets WHERE id = 'linkedin-post-thumbnails';"`
Expected: one row, `public = f`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260424120100_linkedin_post_thumbnails_bucket.sql
git commit -m "feat(db): add linkedin-post-thumbnails storage bucket"
```

---

## Task 3: Add `PostType` enum and row types

**Files:**

- Modify: `lib/enums.ts`
- Create: `lib/platforms/linkedin/post-types.ts`
- Test: `tests/unit/platforms/linkedin/post-types.test.ts`

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/post-types.test.ts
import { describe, test, expect } from 'vitest'
import { LinkedInPostType, isLinkedInPostType } from '@/lib/platforms/linkedin/post-types'

describe('LinkedInPostType', () => {
  test('recognises the five supported post types', () => {
    expect(isLinkedInPostType('image')).toBe(true)
    expect(isLinkedInPostType('video')).toBe(true)
    expect(isLinkedInPostType('text')).toBe(true)
    expect(isLinkedInPostType('article')).toBe(true)
    expect(isLinkedInPostType('poll')).toBe(true)
  })

  test('rejects unsupported strings', () => {
    expect(isLinkedInPostType('story')).toBe(false)
    expect(isLinkedInPostType('')).toBe(false)
  })

  test('enum values match database CHECK constraint', () => {
    expect(LinkedInPostType.Image).toBe('image')
    expect(LinkedInPostType.Text).toBe('text')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/post-types.test.ts`
Expected: FAIL (`Cannot find module`).

**Step 3: Write the implementation**

```ts
// lib/platforms/linkedin/post-types.ts
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

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/post-types.test.ts`
Expected: PASS (3/3).

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/post-types.ts tests/unit/platforms/linkedin/post-types.test.ts
git commit -m "feat(linkedin): add LinkedInPostType enum and row type"
```

---

## Task 4: Pure helper — compute engagement rate

**Files:**

- Create: `lib/platforms/linkedin/engagement.ts`
- Test: `tests/unit/platforms/linkedin/engagement.test.ts`

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/engagement.test.ts
import { describe, test, expect } from 'vitest'
import { computeEngagementRate } from '@/lib/platforms/linkedin/engagement'

describe('computeEngagementRate', () => {
  test('returns (reactions + comments + shares) / impressions', () => {
    expect(
      computeEngagementRate({ reactions: 10, comments: 5, shares: 5, impressions: 1000 })
    ).toBeCloseTo(0.02, 5)
  })

  test('returns null when impressions is zero', () => {
    expect(
      computeEngagementRate({ reactions: 3, comments: 0, shares: 0, impressions: 0 })
    ).toBeNull()
  })

  test('returns null when impressions is negative', () => {
    expect(
      computeEngagementRate({ reactions: 3, comments: 0, shares: 0, impressions: -1 })
    ).toBeNull()
  })

  test('treats missing counts as zero', () => {
    expect(computeEngagementRate({ impressions: 100 })).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/engagement.test.ts`
Expected: FAIL (`Cannot find module`).

**Step 3: Write the implementation**

```ts
// lib/platforms/linkedin/engagement.ts
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

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/engagement.test.ts`
Expected: PASS (4/4).

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/engagement.ts tests/unit/platforms/linkedin/engagement.test.ts
git commit -m "feat(linkedin): add engagement-rate helper"
```

---

## Task 5: Extend `LinkedInClient` — list posts

**Files:**

- Modify: `lib/platforms/linkedin/client.ts`
- Test: `tests/unit/platforms/linkedin/list-posts.test.ts`

**Context:** `LinkedInClient.fetch` is private. Add a new public method `listPosts({ startMs, endMs })` that paginates through `GET /posts?author={orgUrn}&q=author&count=50` until either the oldest returned post is before `startMs` or there is no `paging.links.next`. Return posts with `createdAt >= startMs` only.

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/list-posts.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

const ORG_ID = '12345'

function mockFetchJson(responses: unknown[]) {
  let i = 0
  return vi.spyOn(global, 'fetch').mockImplementation(async () => {
    const body = responses[i++] ?? { elements: [] }
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

describe('LinkedInClient.listPosts', () => {
  beforeEach(() => vi.restoreAllMocks())

  test('returns posts within the date window and stops paginating when older', async () => {
    const now = Date.UTC(2026, 2, 15)
    const oneDay = 86_400_000
    mockFetchJson([
      {
        elements: [
          { id: 'urn:li:ugcPost:1', createdAt: now - 1 * oneDay, commentary: 'recent' },
          { id: 'urn:li:ugcPost:2', createdAt: now - 30 * oneDay, commentary: 'mid' },
        ],
        paging: { count: 2, start: 0 },
      },
    ])
    const client = new LinkedInClient({
      access_token: 't',
      refresh_token: 'r',
      organization_id: ORG_ID,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })

    const posts = await client.listPosts({
      startMs: now - 95 * oneDay,
      endMs: now,
    })

    expect(posts).toHaveLength(2)
    expect(posts[0].id).toBe('urn:li:ugcPost:1')
  })

  test('filters out posts older than the window', async () => {
    const now = Date.UTC(2026, 2, 15)
    const oneDay = 86_400_000
    mockFetchJson([
      {
        elements: [
          { id: 'urn:li:ugcPost:1', createdAt: now - 10 * oneDay },
          { id: 'urn:li:ugcPost:2', createdAt: now - 200 * oneDay },
        ],
      },
    ])
    const client = new LinkedInClient({
      access_token: 't',
      refresh_token: 'r',
      organization_id: ORG_ID,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })

    const posts = await client.listPosts({
      startMs: now - 95 * oneDay,
      endMs: now,
    })

    expect(posts.map((p) => p.id)).toEqual(['urn:li:ugcPost:1'])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/list-posts.test.ts`
Expected: FAIL (`listPosts is not a function`).

**Step 3: Add `listPosts` to `LinkedInClient`**

Add to `lib/platforms/linkedin/client.ts`:

```ts
export interface LinkedInRawPost {
  id: string
  createdAt: number
  commentary?: string
  content?: {
    media?: { id?: string; altText?: string }
    article?: { thumbnail?: string; source?: string; title?: string }
    poll?: unknown
    multiImage?: { images?: Array<{ id?: string }> }
  }
  lifecycleState?: string
}

export interface ListPostsOptions {
  startMs: number
  endMs: number
  maxPages?: number
}

// ...inside LinkedInClient class...
async listPosts(opts: ListPostsOptions): Promise<LinkedInRawPost[]> {
  const maxPages = opts.maxPages ?? 10
  const orgUrn = `urn:li:organization:${this.organizationId}`
  const out: LinkedInRawPost[] = []
  let start = 0
  let pages = 0
  while (pages < maxPages) {
    const data = await this.fetch<{
      elements: LinkedInRawPost[]
      paging?: { start: number; count: number; links?: Array<{ rel: string; href: string }> }
    }>(
      `/posts?author=${encodeURIComponent(orgUrn)}&q=author&count=50&start=${start}`
    )
    const elements = data.elements ?? []
    if (elements.length === 0) break
    let sawOlder = false
    for (const post of elements) {
      if (post.createdAt >= opts.startMs && post.createdAt <= opts.endMs) {
        out.push(post)
      } else if (post.createdAt < opts.startMs) {
        sawOlder = true
      }
    }
    if (sawOlder) break
    const next = data.paging?.links?.find((l) => l.rel === 'next')
    if (!next) break
    start += elements.length
    pages++
  }
  return out
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/list-posts.test.ts`
Expected: PASS (2/2).

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/client.ts tests/unit/platforms/linkedin/list-posts.test.ts
git commit -m "feat(linkedin): list organisation posts via REST API"
```

---

## Task 6: Extend `LinkedInClient` — per-post analytics

**Files:**

- Modify: `lib/platforms/linkedin/client.ts`
- Test: `tests/unit/platforms/linkedin/post-analytics.test.ts`

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/post-analytics.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

function mockFetchJson(body: unknown) {
  return vi.spyOn(global, 'fetch').mockImplementation(async () => {
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

describe('LinkedInClient.getPostAnalytics', () => {
  beforeEach(() => vi.restoreAllMocks())

  test('returns a map keyed by post urn with impression/engagement counts', async () => {
    mockFetchJson({
      elements: [
        {
          share: 'urn:li:ugcPost:1',
          totalShareStatistics: {
            impressionCount: 1000,
            likeCount: 20,
            commentCount: 5,
            shareCount: 3,
          },
        },
        {
          share: 'urn:li:ugcPost:2',
          totalShareStatistics: {
            impressionCount: 500,
            likeCount: 10,
            commentCount: 2,
            shareCount: 1,
          },
        },
      ],
    })

    const client = new LinkedInClient({
      access_token: 't',
      refresh_token: 'r',
      organization_id: '12345',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })

    const result = await client.getPostAnalytics(['urn:li:ugcPost:1', 'urn:li:ugcPost:2'])

    expect(result.get('urn:li:ugcPost:1')).toEqual({
      impressions: 1000,
      reactions: 20,
      comments: 5,
      shares: 3,
    })
    expect(result.get('urn:li:ugcPost:2')).toEqual({
      impressions: 500,
      reactions: 10,
      comments: 2,
      shares: 1,
    })
  })

  test('batches up to 50 urns per request', async () => {
    const spy = mockFetchJson({ elements: [] })
    const client = new LinkedInClient({
      access_token: 't',
      refresh_token: 'r',
      organization_id: '12345',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    const urns = Array.from({ length: 120 }, (_, i) => `urn:li:ugcPost:${i}`)
    await client.getPostAnalytics(urns)
    expect(spy).toHaveBeenCalledTimes(3) // 50 + 50 + 20
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/post-analytics.test.ts`
Expected: FAIL.

**Step 3: Add `getPostAnalytics` to `LinkedInClient`**

```ts
export interface PostAnalytics {
  impressions: number
  reactions: number
  comments: number
  shares: number
}

// ...inside LinkedInClient class...
async getPostAnalytics(postUrns: string[]): Promise<Map<string, PostAnalytics>> {
  const out = new Map<string, PostAnalytics>()
  if (postUrns.length === 0) return out
  const orgUrn = `urn:li:organization:${this.organizationId}`
  const batchSize = 50
  for (let i = 0; i < postUrns.length; i += batchSize) {
    const batch = postUrns.slice(i, i + batchSize)
    const sharesParam = batch.map((u) => `shares[]=${encodeURIComponent(u)}`).join('&')
    const data = await this.fetch<{
      elements: Array<{
        share: string
        totalShareStatistics?: {
          impressionCount?: number
          likeCount?: number
          commentCount?: number
          shareCount?: number
        }
      }>
    }>(
      `/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(orgUrn)}&${sharesParam}`
    )
    for (const el of data.elements ?? []) {
      const s = el.totalShareStatistics ?? {}
      out.set(el.share, {
        impressions: Number(s.impressionCount) || 0,
        reactions: Number(s.likeCount) || 0,
        comments: Number(s.commentCount) || 0,
        shares: Number(s.shareCount) || 0,
      })
    }
  }
  return out
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/post-analytics.test.ts`
Expected: PASS (2/2).

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/client.ts tests/unit/platforms/linkedin/post-analytics.test.ts
git commit -m "feat(linkedin): fetch per-post share statistics in batches"
```

---

## Task 7: Extend `LinkedInClient` — resolve image URN to CDN URL

**Files:**

- Modify: `lib/platforms/linkedin/client.ts`
- Test: `tests/unit/platforms/linkedin/resolve-image.test.ts`

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/resolve-image.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

describe('LinkedInClient.resolveImageUrl', () => {
  beforeEach(() => vi.restoreAllMocks())

  test('returns downloadUrl from /images response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'urn:li:image:abc',
          downloadUrl: 'https://media.licdn.com/abc.jpg',
        }),
        { status: 200 }
      )
    )
    const client = new LinkedInClient({
      access_token: 't',
      refresh_token: 'r',
      organization_id: '12345',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    const url = await client.resolveImageUrl('urn:li:image:abc')
    expect(url).toBe('https://media.licdn.com/abc.jpg')
  })

  test('returns null when downloadUrl missing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'urn:li:image:abc' }), { status: 200 })
    )
    const client = new LinkedInClient({
      access_token: 't',
      refresh_token: 'r',
      organization_id: '12345',
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    })
    expect(await client.resolveImageUrl('urn:li:image:abc')).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/resolve-image.test.ts`
Expected: FAIL.

**Step 3: Add `resolveImageUrl`**

```ts
async resolveImageUrl(imageUrn: string): Promise<string | null> {
  const data = await this.fetch<{ id: string; downloadUrl?: string }>(
    `/images/${encodeURIComponent(imageUrn)}`
  )
  return data.downloadUrl ?? null
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/resolve-image.test.ts`
Expected: PASS (2/2).

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/client.ts tests/unit/platforms/linkedin/resolve-image.test.ts
git commit -m "feat(linkedin): resolve image URN to CDN download URL"
```

---

## Task 8: Classify raw posts into normalised shape

**Files:**

- Create: `lib/platforms/linkedin/classify-post.ts`
- Test: `tests/unit/platforms/linkedin/classify-post.test.ts`

**Context:** Takes a `LinkedInRawPost` from `listPosts()` and returns `{ postType, caption, postUrl, imageUrn }` where `imageUrn` is the first image URN to fetch (null for text/video/article/poll).

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/classify-post.test.ts
import { describe, test, expect } from 'vitest'
import { classifyPost } from '@/lib/platforms/linkedin/classify-post'
import { LinkedInPostType } from '@/lib/platforms/linkedin/post-types'

describe('classifyPost', () => {
  test('identifies a single-image post', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:1',
      createdAt: 0,
      commentary: 'hello',
      content: { media: { id: 'urn:li:image:abc' } },
    })
    expect(result.postType).toBe(LinkedInPostType.Image)
    expect(result.imageUrn).toBe('urn:li:image:abc')
    expect(result.caption).toBe('hello')
    expect(result.postUrl).toBe('https://www.linkedin.com/feed/update/urn:li:ugcPost:1')
  })

  test('identifies a multi-image post and takes the first image', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:2',
      createdAt: 0,
      content: { multiImage: { images: [{ id: 'urn:li:image:1' }, { id: 'urn:li:image:2' }] } },
    })
    expect(result.postType).toBe(LinkedInPostType.Image)
    expect(result.imageUrn).toBe('urn:li:image:1')
  })

  test('identifies a text post when no media/article/poll present', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:3',
      createdAt: 0,
      commentary: 'text only',
    })
    expect(result.postType).toBe(LinkedInPostType.Text)
    expect(result.imageUrn).toBeNull()
  })

  test('identifies an article post', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:4',
      createdAt: 0,
      content: { article: { source: 'https://x.com', title: 'x' } },
    })
    expect(result.postType).toBe(LinkedInPostType.Article)
    expect(result.imageUrn).toBeNull()
  })

  test('identifies a poll post', () => {
    const result = classifyPost({
      id: 'urn:li:ugcPost:5',
      createdAt: 0,
      content: { poll: {} },
    })
    expect(result.postType).toBe(LinkedInPostType.Poll)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/classify-post.test.ts`
Expected: FAIL.

**Step 3: Write implementation**

```ts
// lib/platforms/linkedin/classify-post.ts
import { LinkedInPostType } from './post-types'
import type { LinkedInRawPost } from './client'

export interface ClassifiedPost {
  postType: LinkedInPostType
  caption: string | null
  postUrl: string
  imageUrn: string | null
}

export function classifyPost(raw: LinkedInRawPost): ClassifiedPost {
  const caption = raw.commentary?.trim() || null
  const postUrl = `https://www.linkedin.com/feed/update/${raw.id}`

  const media = raw.content?.media
  const multiImage = raw.content?.multiImage
  const article = raw.content?.article
  const poll = raw.content?.poll

  if (multiImage?.images && multiImage.images.length > 0) {
    return {
      postType: LinkedInPostType.Image,
      caption,
      postUrl,
      imageUrn: multiImage.images[0].id ?? null,
    }
  }
  if (media?.id) {
    const urn = media.id
    const type = urn.startsWith('urn:li:video:') ? LinkedInPostType.Video : LinkedInPostType.Image
    return {
      postType: type,
      caption,
      postUrl,
      imageUrn: type === LinkedInPostType.Image ? urn : null,
    }
  }
  if (article) {
    return { postType: LinkedInPostType.Article, caption, postUrl, imageUrn: null }
  }
  if (poll) {
    return { postType: LinkedInPostType.Poll, caption, postUrl, imageUrn: null }
  }
  return { postType: LinkedInPostType.Text, caption, postUrl, imageUrn: null }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/classify-post.test.ts`
Expected: PASS (5/5).

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/classify-post.ts tests/unit/platforms/linkedin/classify-post.test.ts
git commit -m "feat(linkedin): classify raw posts into normalised shape"
```

---

## Task 9: Thumbnail downloader with concurrency limit

**Files:**

- Create: `lib/platforms/linkedin/download-thumbnails.ts`
- Test: `tests/unit/platforms/linkedin/download-thumbnails.test.ts`

**Context:** Given an array of `{ organizationId, linkedinUrn, imageCdnUrl }`, downloads each image binary and uploads to Supabase Storage at `{organizationId}/{linkedin_urn}.jpg`. Returns a map from `linkedin_urn → thumbnail_path`. Runs at most 5 downloads in parallel. Any single failure is logged and skipped (not thrown).

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/download-thumbnails.test.ts
import { describe, test, expect, vi } from 'vitest'
import { downloadThumbnails } from '@/lib/platforms/linkedin/download-thumbnails'

function fakeSupabase(uploadBehaviour: 'ok' | 'fail' = 'ok') {
  const uploads: string[] = []
  return {
    uploads,
    storage: {
      from: (_bucket: string) => ({
        upload: vi.fn(async (path: string) => {
          uploads.push(path)
          return uploadBehaviour === 'ok'
            ? { data: { path }, error: null }
            : { data: null, error: new Error('boom') }
        }),
      }),
    },
  }
}

describe('downloadThumbnails', () => {
  test('uploads each thumbnail to {org}/{urn}.jpg and returns the map', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )
    const sb = fakeSupabase('ok')
    const result = await downloadThumbnails(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sb as any,
      [
        {
          organizationId: 'org1',
          linkedinUrn: 'urn:li:ugcPost:1',
          imageCdnUrl: 'https://media.licdn.com/a.jpg',
        },
      ]
    )
    expect(result.get('urn:li:ugcPost:1')).toBe('org1/urn:li:ugcPost:1.jpg')
    expect(sb.uploads).toEqual(['org1/urn:li:ugcPost:1.jpg'])
  })

  test('skips failed uploads without throwing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )
    const sb = fakeSupabase('fail')
    const result = await downloadThumbnails(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sb as any,
      [
        {
          organizationId: 'org1',
          linkedinUrn: 'urn:li:ugcPost:1',
          imageCdnUrl: 'https://media.licdn.com/a.jpg',
        },
      ]
    )
    expect(result.size).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/download-thumbnails.test.ts`
Expected: FAIL.

**Step 3: Write implementation**

```ts
// lib/platforms/linkedin/download-thumbnails.ts
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
  const queue = [...jobs]
  const workers = Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
    while (queue.length > 0) {
      const job = queue.shift()
      if (!job) break
      try {
        const res = await fetch(job.imageCdnUrl)
        if (!res.ok) continue
        const buf = new Uint8Array(await res.arrayBuffer())
        const path = `${job.organizationId}/${job.linkedinUrn}.jpg`
        const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
          contentType: 'image/jpeg',
          upsert: true,
        })
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

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/download-thumbnails.test.ts`
Expected: PASS (2/2).

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/download-thumbnails.ts tests/unit/platforms/linkedin/download-thumbnails.test.ts
git commit -m "feat(linkedin): download thumbnails to storage with concurrency cap"
```

---

## Task 10: `syncLinkedInPosts(connection)` orchestrator

**Files:**

- Modify: `lib/platforms/linkedin/actions.ts` (add new exported function at bottom)
- Test: `tests/unit/platforms/linkedin/sync-posts.test.ts`

**Context:** This is the cron entrypoint. Signature mirrors `syncMetricsForLinkedInConnection`:

```ts
export async function syncLinkedInPosts(
  connectionId: string,
  organizationId: string,
  storedCredentials: StoredCredentials,
  supabase: SupabaseClient
): Promise<void>
```

Flow:

1. Decrypt credentials, construct `LinkedInClient`.
2. Compute window: last 95 days (`Date.now() - 95 * 86_400_000`).
3. `client.listPosts({ startMs, endMs })`.
4. For each post, classify → build upsert row with initial zero counters.
5. Upsert all rows by `(organization_id, linkedin_urn)`.
6. Fetch existing rows that are either new or ≤90 days old → `getPostAnalytics(urns)` → update rows with refreshed counters and recomputed `engagement_rate` and `analytics_updated_at`.
7. For each row where `thumbnail_path IS NULL` and `post_type = 'image'`: resolve image URN → CDN URL, then `downloadThumbnails` → update rows with `thumbnail_path`.

**Step 1: Write the failing test**

```ts
// tests/unit/platforms/linkedin/sync-posts.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'

// Mock the inner helpers so this test stays a pure orchestration test.
vi.mock('@/lib/platforms/linkedin/client', () => ({
  LinkedInClient: vi.fn().mockImplementation(() => ({
    listPosts: vi.fn(async () => [
      {
        id: 'urn:li:ugcPost:1',
        createdAt: Date.now(),
        commentary: 'hello',
        content: { media: { id: 'urn:li:image:abc' } },
      },
    ]),
    getPostAnalytics: vi.fn(
      async () =>
        new Map([
          ['urn:li:ugcPost:1', { impressions: 1000, reactions: 20, comments: 5, shares: 5 }],
        ])
    ),
    resolveImageUrl: vi.fn(async () => 'https://media.licdn.com/abc.jpg'),
  })),
}))
vi.mock('@/lib/platforms/linkedin/download-thumbnails', () => ({
  downloadThumbnails: vi.fn(
    async () => new Map([['urn:li:ugcPost:1', 'org1/urn:li:ugcPost:1.jpg']])
  ),
}))
vi.mock('@/lib/utils/crypto', () => ({
  decryptCredentials: (x: unknown) => x,
}))

import { syncLinkedInPosts } from '@/lib/platforms/linkedin/actions'

describe('syncLinkedInPosts', () => {
  beforeEach(() => vi.clearAllMocks())

  test('upserts posts, refreshes analytics, and records thumbnails', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ error: null })
    const updateSpy = vi.fn().mockResolvedValue({ error: null })
    const selectSpy = vi.fn().mockResolvedValue({
      data: [
        {
          linkedin_urn: 'urn:li:ugcPost:1',
          posted_at: new Date().toISOString(),
          post_type: 'image',
          thumbnail_path: null,
        },
      ],
      error: null,
    })
    const eq = () => ({ eq, gte: () => ({ is: () => ({ select: selectSpy }) }), select: selectSpy })
    const fakeSupabase = {
      from: vi.fn().mockReturnValue({
        upsert: upsertSpy,
        update: () => ({ eq, match: () => ({ select: updateSpy }) }),
        select: () => ({ eq }),
      }),
    }

    await syncLinkedInPosts(
      'conn-1',
      'org1',
      {
        access_token: 't',
        refresh_token: 'r',
        organization_id: '12345',
        expires_at: new Date().toISOString(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeSupabase as any
    )

    expect(upsertSpy).toHaveBeenCalled()
    const upsertCall = upsertSpy.mock.calls[0][0]
    expect(upsertCall[0].linkedin_urn).toBe('urn:li:ugcPost:1')
  })
})
```

> Note: this is an integration-leaning unit test. If the Supabase fake above becomes unwieldy, switch to an in-memory adapter via `tests/helpers/fake-supabase.ts` (not shipped yet — fine to inline here).

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/platforms/linkedin/sync-posts.test.ts`
Expected: FAIL (`syncLinkedInPosts is not a function`).

**Step 3: Implement `syncLinkedInPosts` in `lib/platforms/linkedin/actions.ts`**

Append the new exported function. Use `LinkedInClient`, `classifyPost`, `computeEngagementRate`, `downloadThumbnails`, and `LinkedInPostType` imports.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/platforms/linkedin/sync-posts.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/platforms/linkedin/actions.ts tests/unit/platforms/linkedin/sync-posts.test.ts
git commit -m "feat(linkedin): sync org posts into linkedin_posts table"
```

---

## Task 11: Wire `syncLinkedInPosts` into the daily cron

**Files:**

- Modify: `app/api/cron/daily-metrics-sync/route.ts`
- Test: `tests/unit/api/cron/daily-metrics-sync.test.ts` (if it exists; else add a focused test)

**Context:** Inside the `syncConnection` helper, after `syncMetricsForLinkedInConnection(...)` succeeds for LinkedIn, also call `syncLinkedInPosts(...)`. Wrap the new call in its own try/catch so a posts failure does not fail the whole connection's metric sync. Do not run posts sync during backfill mode — it's idempotent daily, backfilling posts 95 days at a time per day would be wasteful.

**Step 1: Write the failing test**

If `tests/unit/api/cron/daily-metrics-sync.test.ts` exists, extend it; otherwise create:

```ts
// tests/unit/api/cron/daily-metrics-sync.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/platforms/linkedin/actions', () => ({
  syncMetricsForLinkedInConnection: vi.fn(async () => {}),
  syncLinkedInPosts: vi.fn(async () => {}),
}))
vi.mock('@/lib/platforms/google-analytics/actions', () => ({
  syncMetricsForGoogleAnalyticsConnection: vi.fn(async () => {}),
}))
vi.mock('@/lib/platforms/hubspot/actions', () => ({
  syncMetricsForHubSpotConnection: vi.fn(async () => {}),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (_t: string) => ({
      insert: () => ({
        select: () => ({ single: async () => ({ data: { id: 'log-1' }, error: null }) }),
      }),
      select: () => ({ eq: () => ({ data: [], error: null }) }),
      update: () => ({ eq: async () => ({}) }),
    }),
  }),
}))

import { syncLinkedInPosts } from '@/lib/platforms/linkedin/actions'
import { POST } from '@/app/api/cron/daily-metrics-sync/route'

describe('daily-metrics-sync cron', () => {
  beforeEach(() => vi.clearAllMocks())

  test('calls syncLinkedInPosts once per active LinkedIn connection in normal mode', async () => {
    // Use the module-level helper to stub the connections query to return 1 LinkedIn connection.
    // Implementation detail: you may prefer to expose a `syncConnection` helper for direct testing
    // instead of driving the POST handler end-to-end.
    process.env.CRON_SECRET = 'secret'
    const req = new Request('http://localhost/api/cron/daily-metrics-sync', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
    })
    await POST(req)
    // Assertion will require exposing the connections list via a module factory or by
    // extracting `syncConnection` into a testable export. See Step 3 for refactor.
    expect(syncLinkedInPosts).toHaveBeenCalled()
  })
})
```

> **Note:** If driving `POST` directly is too painful, extract `syncConnection` into a named export from the route module (Next.js allows non-default exports alongside `POST`). Drive that helper directly from the test with a fake supabase client and a synthetic connection.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/api/cron/daily-metrics-sync.test.ts`
Expected: FAIL.

**Step 3: Modify the route**

In `app/api/cron/daily-metrics-sync/route.ts`:

```ts
import {
  syncMetricsForLinkedInConnection,
  syncLinkedInPosts,
} from '@/lib/platforms/linkedin/actions'

// ...inside syncConnection, case 'linkedin':
await syncMetricsForLinkedInConnection(/* ... */)
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

Pass `isBackfill` into `syncConnection` (add a parameter).

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/api/cron/daily-metrics-sync.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/cron/daily-metrics-sync/route.ts tests/unit/api/cron/daily-metrics-sync.test.ts
git commit -m "feat(cron): sync LinkedIn posts after daily metrics sync"
```

---

## Task 12: Extend `fetchLinkedInData` to populate `top_posts`

**Files:**

- Modify: `lib/reviews/fetchers/linkedin.ts`
- Test: `tests/unit/reviews/fetchers/linkedin.test.ts` (extend existing)

**Context:** After computing metrics, query `linkedin_posts` with:

```
.from('linkedin_posts')
.select('*')
.eq('organization_id', organizationId)
.gte('posted_at', periods.main.start)
.lte('posted_at', periods.main.end)
.not('engagement_rate', 'is', null)
.order('engagement_rate', { ascending: false })
.limit(4)
```

For each row with `thumbnail_path`, mint a 1-year signed URL via `supabase.storage.from('linkedin-post-thumbnails').createSignedUrl(path, 365 * 24 * 3600)`. Map each row to `LinkedInTopPost`. Return the array on `LinkedInData.top_posts`.

**Step 1: Write the failing test**

Extend `tests/unit/reviews/fetchers/linkedin.test.ts` with a case:

```ts
test('returns top 4 posts sorted by engagement rate with signed thumbnail URLs', async () => {
  // Arrange: fake supabase that returns 4 rows ordered by engagement_rate desc,
  // and a storage.createSignedUrl stub that returns a predictable URL per path.
  // Act: call fetchLinkedInData
  // Assert: result.top_posts has 4 entries, each mapped to LinkedInTopPost shape,
  //         thumbnail_url populated for rows with thumbnail_path, null otherwise.
})
```

Mirror the existing mock style used by other fetcher tests in the file.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reviews/fetchers/linkedin.test.ts`
Expected: FAIL.

**Step 3: Implement in `lib/reviews/fetchers/linkedin.ts`**

Replace `return { metrics, top_posts: [] }` with the query + mapping logic. Keep the function signature unchanged.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reviews/fetchers/linkedin.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/reviews/fetchers/linkedin.ts tests/unit/reviews/fetchers/linkedin.test.ts
git commit -m "feat(reviews): populate LinkedIn top_posts with signed URLs"
```

---

## Task 13: Add `content_highlights` to `NarrativeBlocks`

**Files:**

- Modify: `lib/reviews/types.ts`
- Modify: `lib/reviews/narrative/prompts.ts` (extend `NARRATIVE_BLOCK_KEYS` + `defaultTemplates`)
- Test: `tests/unit/reviews/narrative/prompts.test.ts` (extend)

**Step 1: Write the failing test**

Add to `tests/unit/reviews/narrative/prompts.test.ts`:

```ts
test('contentHighlightsPrompt includes captions, engagement rates, and style memo', () => {
  const ctx = {
    organizationName: 'Acme',
    quarter: 'Q1 2026',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    data: {
      linkedin: {
        metrics: {},
        top_posts: [
          {
            id: 'urn:li:ugcPost:1',
            url: null,
            thumbnail_url: null,
            caption: 'Great quarter',
            posted_at: '2026-02-01',
            impressions: 1000,
            reactions: 20,
            comments: 5,
            shares: 5,
            engagement_rate: 0.03,
          },
        ],
      },
    },
    styleMemo: 'Use confident voice.',
  }
  const prompt = contentHighlightsPrompt(ctx)
  expect(prompt).toContain('What Resonated')
  expect(prompt).toContain('Great quarter')
  expect(prompt).toContain('Use confident voice.')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reviews/narrative/prompts.test.ts`
Expected: FAIL.

**Step 3: Update types and prompts**

- In `lib/reviews/types.ts`: add `content_highlights?: string` to `NarrativeBlocks`.
- In `lib/reviews/narrative/prompts.ts`: add `'content_highlights'` to `NARRATIVE_BLOCK_KEYS`, write `defaultTemplateContentHighlights()`, add `contentHighlightsPrompt()`, register in `defaultTemplates`. Also update the `BodySection` key type if TS complains.

```ts
export function defaultTemplateContentHighlights(): string {
  return [
    'The slide shows the four LinkedIn posts with the highest engagement rate this quarter.',
    'Write a 1-2 sentence summary of what resonated: the theme, tone, or format that unites these posts.',
    'Plain text only. Warm, confident, consultative tone. No markdown.',
    'Lead with the pattern, not the metrics — the cards above already show the numbers.',
    '',
    'If fewer than 2 posts are provided, focus on that single post instead of a pattern.',
    'If no posts are provided, output: "No posts met the threshold for analysis this quarter."',
  ].join('\n')
}

export function contentHighlightsPrompt(ctx: PromptContext, template?: string): string {
  return wrap(ctx, resolve(template, defaultTemplateContentHighlights()))
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reviews/narrative/prompts.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/reviews/types.ts lib/reviews/narrative/prompts.ts tests/unit/reviews/narrative/prompts.test.ts
git commit -m "feat(reviews): add content_highlights narrative block"
```

---

## Task 14: Generate `content_highlights` in narrative pipeline

**Files:**

- Modify: `lib/reviews/narrative/generator.ts`
- Test: `tests/unit/reviews/narrative/generator.test.ts` (extend)

**Context:** The generator iterates over `NARRATIVE_BLOCK_KEYS`. Once Task 13 adds `'content_highlights'` to that list, the generator's block-dispatch switch (or map) must handle it too. Add a case that calls `contentHighlightsPrompt()`.

**Step 1: Write the failing test**

Extend `tests/unit/reviews/narrative/generator.test.ts`:

```ts
test('generates content_highlights block when top_posts present', async () => {
  const result = await generateNarrative({
    // ...existing context helpers...
    data: {
      linkedin: {
        metrics: {},
        top_posts: [
          /* four posts */
        ],
      },
    },
  })
  expect(result.content_highlights).toBeDefined()
  expect(typeof result.content_highlights).toBe('string')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reviews/narrative/generator.test.ts`
Expected: FAIL.

**Step 3: Add case in generator**

Follow the pattern used for `linkedin_insights`. The key is also read in the prompt-override lookup so organisations can override the template.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reviews/narrative/generator.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/reviews/narrative/generator.ts tests/unit/reviews/narrative/generator.test.ts
git commit -m "feat(reviews): generate content_highlights block"
```

---

## Task 15: Include `content_highlights` in style-memo learner diff

**Files:**

- Modify: `lib/reviews/narrative/learn.ts`
- Modify: `lib/reviews/narrative/style-memo-shared.ts` (`buildLearnerDiff`)
- Test: `tests/unit/reviews/narrative/style-memo.test.ts` (extend)

**Context:** `buildLearnerDiff` builds the before/after diff fed to Claude during the learner run. It iterates over the same `NARRATIVE_BLOCK_KEYS`; once `content_highlights` is added there it will flow through automatically. Verify with a test.

**Step 1: Write the failing test**

```ts
test('learner diff includes content_highlights edits', () => {
  const diff = buildLearnerDiff(
    { content_highlights: 'AI original copy' },
    { content_highlights: 'Human-edited copy' }
  )
  expect(diff).toContain('content_highlights')
  expect(diff).toContain('AI original copy')
  expect(diff).toContain('Human-edited copy')
})
```

**Step 2: Run test to verify behaviour**

Run: `npx vitest run tests/unit/reviews/narrative/style-memo.test.ts`
Expected: PASS if Tasks 13 & 14 already made the key flow through; if FAIL, update `buildLearnerDiff` to iterate `NARRATIVE_BLOCK_KEYS` (which already includes the new key after Task 13).

**Step 3: Commit**

```bash
git add lib/reviews/narrative/learn.ts lib/reviews/narrative/style-memo-shared.ts tests/unit/reviews/narrative/style-memo.test.ts
git commit -m "feat(reviews): surface content_highlights edits to style-memo learner"
```

---

## Task 16: `TextPostPlaceholder` component

**Files:**

- Create: `components/reviews/review-deck/text-post-placeholder.tsx`
- Test: `tests/unit/components/reviews/review-deck/text-post-placeholder.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TextPostPlaceholder } from '@/components/reviews/review-deck/text-post-placeholder'

describe('TextPostPlaceholder', () => {
  test('renders with expected testid and aspect-ratio class', () => {
    render(<TextPostPlaceholder />)
    const el = screen.getByTestId('text-post-placeholder')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/aspect-/)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/reviews/review-deck/text-post-placeholder.test.tsx`
Expected: FAIL.

**Step 3: Implement**

```tsx
// components/reviews/review-deck/text-post-placeholder.tsx
export function TextPostPlaceholder() {
  return (
    <div
      data-testid="text-post-placeholder"
      className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white/60"
      aria-hidden="true"
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 17h2.5l2-4H8V7h6v6l-2 4h-2.5l2 4H7zm10 0h2.5l2-4H18V7h6v6l-2 4h-2.5l2 4H17z" />
      </svg>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/reviews/review-deck/text-post-placeholder.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/reviews/review-deck/text-post-placeholder.tsx tests/unit/components/reviews/review-deck/text-post-placeholder.test.tsx
git commit -m "feat(reviews): add TextPostPlaceholder component"
```

---

## Task 17: `TopPostCard` component

**Files:**

- Create: `components/reviews/review-deck/top-post-card.tsx`
- Test: `tests/unit/components/reviews/review-deck/top-post-card.test.tsx`

**Context:** Card structure: image slot (aspect-locked) → caption (line-clamp-2) → engagement rate (big) → micro row (impressions · engagements). If `thumbnail_url` is null, render `<TextPostPlaceholder />` in the image slot. `onError` on the `<img>` also swaps to the placeholder (use `useState` for the fallback flag). Rates formatted as `X.X%`; numbers use `toLocaleString()`.

**Step 1: Write the failing test**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopPostCard } from '@/components/reviews/review-deck/top-post-card'
import type { LinkedInTopPost } from '@/lib/reviews/types'

const base: LinkedInTopPost = {
  id: 'urn:li:ugcPost:1',
  url: 'https://linkedin.com/feed/update/urn:li:ugcPost:1',
  thumbnail_url: null,
  caption: 'Great quarter of content',
  posted_at: '2026-02-01',
  impressions: 12345,
  reactions: 200,
  comments: 30,
  shares: 20,
  engagement_rate: 0.0203,
}

describe('TopPostCard', () => {
  test('renders caption, formatted engagement rate, impressions, and total engagements', () => {
    render(<TopPostCard post={base} />)
    expect(screen.getByText('Great quarter of content')).toBeInTheDocument()
    expect(screen.getByText('2.0%')).toBeInTheDocument()
    expect(screen.getByText('12,345')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument() // 200 + 30 + 20
  })

  test('renders TextPostPlaceholder when thumbnail_url is null', () => {
    render(<TopPostCard post={base} />)
    expect(screen.getByTestId('text-post-placeholder')).toBeInTheDocument()
  })

  test('renders <img> when thumbnail_url is provided', () => {
    render(<TopPostCard post={{ ...base, thumbnail_url: 'https://example.com/t.jpg' }} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/t.jpg')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/reviews/review-deck/top-post-card.test.tsx`
Expected: FAIL.

**Step 3: Implement**

```tsx
// components/reviews/review-deck/top-post-card.tsx
'use client'

import { useState } from 'react'
import { TextPostPlaceholder } from './text-post-placeholder'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface TopPostCardProps {
  post: LinkedInTopPost
}

export function TopPostCard({ post }: TopPostCardProps) {
  const [broken, setBroken] = useState(false)
  const totalEngagements = post.reactions + post.comments + post.shares
  return (
    <div data-testid="top-post-card" className="flex w-full max-w-[240px] flex-col gap-3">
      <div className="overflow-hidden rounded-md">
        {post.thumbnail_url && !broken ? (
          <img
            src={post.thumbnail_url}
            alt=""
            className="aspect-[4/3] w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <TextPostPlaceholder />
        )}
      </div>
      <p className="text-foreground/90 line-clamp-2 text-sm">{post.caption ?? ''}</p>
      <div className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--deck-accent)' }}>
        {(post.engagement_rate * 100).toFixed(1)}%
      </div>
      <div className="text-foreground/60 text-xs tabular-nums">
        {post.impressions.toLocaleString()} · {totalEngagements.toLocaleString()}
      </div>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/reviews/review-deck/top-post-card.test.tsx`
Expected: PASS (3/3).

**Step 5: Commit**

```bash
git add components/reviews/review-deck/top-post-card.tsx tests/unit/components/reviews/review-deck/top-post-card.test.tsx
git commit -m "feat(reviews): add TopPostCard component"
```

---

## Task 18: `TopPostGrid` component

**Files:**

- Create: `components/reviews/review-deck/top-post-grid.tsx`
- Test: `tests/unit/components/reviews/review-deck/top-post-grid.test.tsx`

**Context:** Horizontally centered grid. Always renders posts at fixed card width; 1-4 cards. Returns `null` if posts array is empty.

**Step 1: Write the failing test**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TopPostGrid } from '@/components/reviews/review-deck/top-post-grid'

const makePost = (n: number) => ({
  id: `urn:li:ugcPost:${n}`,
  url: null,
  thumbnail_url: null,
  caption: `Post ${n}`,
  posted_at: '2026-02-01',
  impressions: 1000,
  reactions: 20,
  comments: 5,
  shares: 5,
  engagement_rate: 0.03,
})

describe('TopPostGrid', () => {
  test('renders one card per post', () => {
    render(<TopPostGrid posts={[makePost(1), makePost(2), makePost(3), makePost(4)]} />)
    expect(screen.getAllByTestId('top-post-card')).toHaveLength(4)
  })

  test('renders fewer than 4 centered', () => {
    render(<TopPostGrid posts={[makePost(1), makePost(2)]} />)
    expect(screen.getAllByTestId('top-post-card')).toHaveLength(2)
    const grid = screen.getByTestId('top-post-grid')
    expect(grid.className).toMatch(/justify-center/)
  })

  test('returns null when posts is empty', () => {
    const { container } = render(<TopPostGrid posts={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/reviews/review-deck/top-post-grid.test.tsx`
Expected: FAIL.

**Step 3: Implement**

```tsx
// components/reviews/review-deck/top-post-grid.tsx
import { TopPostCard } from './top-post-card'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface TopPostGridProps {
  posts: LinkedInTopPost[]
}

export function TopPostGrid({ posts }: TopPostGridProps) {
  if (posts.length === 0) return null
  return (
    <div data-testid="top-post-grid" className="flex w-full flex-wrap justify-center gap-6">
      {posts.map((post) => (
        <TopPostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/reviews/review-deck/top-post-grid.test.tsx`
Expected: PASS (3/3).

**Step 5: Commit**

```bash
git add components/reviews/review-deck/top-post-grid.tsx tests/unit/components/reviews/review-deck/top-post-grid.test.tsx
git commit -m "feat(reviews): add TopPostGrid component"
```

---

## Task 19: `ContentBodySlide` slide component

**Files:**

- Create: `components/reviews/review-deck/content-body-slide.tsx`
- Test: `tests/unit/components/reviews/review-deck/content-body-slide.test.tsx`

**Step 1: Write the failing test**

```tsx
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentBodySlide } from '@/components/reviews/review-deck/content-body-slide'

describe('ContentBodySlide', () => {
  test('renders heading, grid, and narrative', () => {
    render(
      <ContentBodySlide
        narrative="These posts worked because they were specific."
        posts={[
          {
            id: 'urn:li:ugcPost:1',
            url: null,
            thumbnail_url: null,
            caption: 'Specific post',
            posted_at: '2026-02-01',
            impressions: 1000,
            reactions: 20,
            comments: 5,
            shares: 5,
            engagement_rate: 0.03,
          },
        ]}
        mode="screen"
      />
    )
    expect(screen.getByRole('heading', { name: 'What Resonated' })).toBeInTheDocument()
    expect(screen.getByTestId('top-post-grid')).toBeInTheDocument()
    expect(screen.getByTestId('content-body-slide-content')).toHaveTextContent(
      'These posts worked because they were specific.'
    )
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/reviews/review-deck/content-body-slide.test.tsx`
Expected: FAIL.

**Step 3: Implement**

```tsx
// components/reviews/review-deck/content-body-slide.tsx
import { TopPostGrid } from './top-post-grid'
import { SlideNarrative } from './slide-narrative'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface ContentBodySlideProps {
  narrative: string
  posts: LinkedInTopPost[]
  mode: 'screen' | 'print'
}

export function ContentBodySlide({ narrative, posts, mode: _mode }: ContentBodySlideProps) {
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

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/reviews/review-deck/content-body-slide.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/reviews/review-deck/content-body-slide.tsx tests/unit/components/reviews/review-deck/content-body-slide.test.tsx
git commit -m "feat(reviews): add ContentBodySlide component"
```

---

## Task 20: Wire new slide into `ReviewDeck`

**Files:**

- Modify: `components/reviews/review-deck/index.tsx`
- Test: `tests/unit/components/reviews/review-deck/review-deck.test.tsx` (extend)

**Context:** Add `ContentBodySlide` import, a `'content'` variant to the `BodySection` tagged union, and an entry in `BODY_SECTIONS` between `linkedin_insights` and `initiatives`. When `data?.linkedin?.top_posts` is missing or empty, filter that entry out of `BODY_SECTIONS` before rendering so the deck count stays honest.

**Step 1: Write the failing test**

Extend `tests/unit/components/reviews/review-deck/review-deck.test.tsx`:

```tsx
test('renders "What Resonated" slide between LinkedIn and Initiatives when top_posts non-empty', () => {
  render(
    <ReviewDeck
      organization={{ name: 'Acme', logo_url: null, primary_color: null }}
      quarter="Q1 2026"
      periodStart="2026-01-01"
      periodEnd="2026-03-31"
      narrative={{ content_highlights: 'Narrative copy' }}
      data={{
        linkedin: {
          metrics: {},
          top_posts: [
            /* one post */
          ],
        },
      }}
    />
  )
  expect(screen.getByRole('heading', { name: 'What Resonated' })).toBeInTheDocument()
})

test('omits "What Resonated" slide when top_posts is missing', () => {
  render(
    <ReviewDeck
      organization={{ name: 'Acme', logo_url: null, primary_color: null }}
      quarter="Q1 2026"
      periodStart="2026-01-01"
      periodEnd="2026-03-31"
      narrative={{}}
      data={{ linkedin: { metrics: {} } }}
    />
  )
  expect(screen.queryByRole('heading', { name: 'What Resonated' })).not.toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/components/reviews/review-deck/review-deck.test.tsx`
Expected: FAIL.

**Step 3: Implement**

Update the file:

```tsx
import { ContentBodySlide } from './content-body-slide'

type BodySection =
  | {
      key: Exclude<
        keyof NarrativeBlocks,
        'cover_subtitle' | 'ga_summary' | 'linkedin_insights' | 'content_highlights'
      >
      heading: string
      kind: 'default'
    }
  | { key: 'ga_summary'; heading: string; kind: 'ga' }
  | { key: 'linkedin_insights'; heading: string; kind: 'linkedin' }
  | { key: 'content_highlights'; heading: string; kind: 'content' }

const BODY_SECTIONS: readonly BodySection[] = [
  { key: 'ga_summary', heading: 'Google Analytics', kind: 'ga' },
  { key: 'linkedin_insights', heading: 'LinkedIn', kind: 'linkedin' },
  { key: 'content_highlights', heading: 'What Resonated', kind: 'content' },
  { key: 'initiatives', heading: 'Initiatives', kind: 'default' },
  { key: 'takeaways', heading: 'Takeaways', kind: 'default' },
  { key: 'planning', heading: 'Planning Ahead', kind: 'default' },
]
```

Then in the `bodySlides` mapping, add:

```tsx
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

Filter nulls: `.filter((s): s is BuiltSlide => s !== null)` on the resulting array.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/components/reviews/review-deck/review-deck.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add components/reviews/review-deck/index.tsx tests/unit/components/reviews/review-deck/review-deck.test.tsx
git commit -m "feat(reviews): render What Resonated slide conditionally"
```

---

## Task 21: Visual snapshot — "What Resonated" slide

**Files:**

- Modify: `tests/e2e/visual.spec.ts` (add a new test)

**Step 1: Add the test**

Seed a test org with 4 `linkedin_posts` rows (or stub `fetchLinkedInData` at the route layer — check existing patterns in the file). Navigate to the review deck page, advance to the "What Resonated" slide (or go directly via URL hash / keyboard arrow), wait for `[data-testid="content-body-slide-content"]`, then:

```ts
test('what resonated slide', async ({ page }) => {
  await page.goto('/<org>/reports/<review>/preview')
  await page.waitForSelector('[data-testid="content-body-slide-content"]')
  await expect(page).toHaveScreenshot('what-resonated-slide.png', { fullPage: false })
})
```

Also add a variant with only 2 posts to lock in the centered layout.

**Step 2: Run E2E once to produce baselines**

Run: `npm run test:e2e:update-snapshots -- --grep "what resonated"`
Expected: new baseline files under `tests/e2e/visual.spec.ts-snapshots/`.

**Step 3: Review and commit**

Inspect new snapshots visually. Commit:

```bash
git add tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots/
git commit -m "test(e2e): visual snapshots for What Resonated slide"
```

---

## Task 22: Full verification + open PR

**Step 1: Run the full check suite from the worktree root**

Run: `npm run lint && npm run test:unit && npm run build`
Expected: all three pass.

**Step 2: Run the visual E2E once more to confirm no drift**

Run: `npx playwright test tests/e2e/visual.spec.ts`
Expected: PASS.

**Step 3: Review the diff**

Run: `git diff main --stat`
Spot-check any noisy files; ensure no `console.log` or TODOs left behind.

**Step 4: Push and open PR**

```bash
git push -u origin feature/linkedin-top-posts
gh pr create --title "LinkedIn top posts: What Resonated slide" --body "$(cat <<'EOF'
## Summary
- New `linkedin_posts` table + Supabase Storage bucket, synced daily
- New "What Resonated" slide in the quarterly performance deck showing top 4 posts by engagement rate
- New `content_highlights` narrative block with AI originals + style-memo learner integration

## Test plan
- [ ] `npm run lint && npm run test:unit && npm run build`
- [ ] `npx playwright test tests/e2e/visual.spec.ts`
- [ ] Manual: run `syncLinkedInPosts` against a staging org with LinkedIn connected; confirm thumbnails render, captions read well, engagement rates plausible
- [ ] Manual: preview a quarterly report for an org with real data; advance to "What Resonated"; publish; confirm share link renders it

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 5: After opening the PR**

- Watch CI. If E2E / snapshot diffs fail, download the `snapshot-diffs` artifact and triage.
- Confirm the migrations show up cleanly in Supabase preview if a preview branch is configured.

---

## Out of scope (deferred)

- Top posts across multiple quarters / engagement trend chart
- User-pinned / user-overridden post lists
- Comment/reply content analysis
- Post scheduling or publishing
- Employee-advocacy / non-org-owned post analytics
