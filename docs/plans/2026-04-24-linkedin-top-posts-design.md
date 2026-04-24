# LinkedIn Top Posts — Performance Report Slide Design

**Status:** Approved for implementation
**Date:** 2026-04-24

## Goal

Add a new "What Resonated" slide to the quarterly performance report that surfaces the top 4 LinkedIn posts by engagement rate. Populates the already-defined `LinkedInTopPost` type that the narrative layer is primed to consume.

## Product decisions

| Decision | Choice |
| --- | --- |
| Ranking | Engagement rate = `(reactions + comments + shares) / impressions` |
| Card content | Thumbnail + caption (2-line clamp) + engagement rate (big) + impressions + total engagements |
| Storage | New `linkedin_posts` table, synced daily by existing cron |
| Text-only post fallback | Styled placeholder filling the image slot so card dimensions stay consistent |
| Thumbnails | Downloaded to Supabase Storage at sync time; 1-year signed URLs per report |
| Post qualification | Posts published within the quarter `main` period only |
| Fewer than 4 posts | Render up to 4, horizontally centered; hide the slide entirely if zero |
| Slide title | "What Resonated" (editorial voice, matches Takeaways / Planning Ahead) |
| Slide position | Between the LinkedIn tiles slide and Initiatives |

## Data model

### Table `linkedin_posts`

```
id                      uuid pk
organization_id         uuid fk → organizations (RLS isolated, same policy as campaign_metrics)
platform_connection_id  uuid fk → platform_connections
linkedin_urn            text    -- e.g. urn:li:ugcPost:12345
posted_at               timestamptz
caption                 text
post_url                text    -- public linkedin.com link
thumbnail_path          text null  -- Supabase Storage path, null = text-only
post_type               text    -- 'image' | 'video' | 'text' | 'article' | 'poll'
impressions             integer
reactions               integer
comments                integer
shares                  integer
engagement_rate         numeric -- computed, stored for ORDER BY
analytics_updated_at    timestamptz
created_at              timestamptz
```

**Indexes**
- `(organization_id, posted_at DESC)` — quarter queries
- `(organization_id, linkedin_urn)` unique — upsert key

### Storage bucket `linkedin-post-thumbnails`

Private bucket. Path pattern: `{organization_id}/{linkedin_urn}.jpg`.

## LinkedIn API

### Scopes

No new scopes required. Existing app already has:
- `r_organization_social` — read org posts + per-post analytics
- `r_organization_admin` — org-level analytics (already in use)

### Endpoints

All on `https://api.linkedin.com/rest`, API version `202601` (matches existing client).

1. **List posts** — `GET /posts?author={orgUrn}&q=author&count=50` with date-range filter. Paginated.
2. **Per-post analytics** — `GET /organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity={orgUrn}&shares[]={postUrn}` — batch up to ~50 post URNs per call.
3. **Media binary** — resolve `image` URN via `GET /images/{urn}` → fetch CDN URL → upload binary to Supabase Storage.

### Rate limit budget

~500 req/user-app-day. Worst case per org per day: 1 list + 2 analytics batches + ~10 media fetches ≈ 13 calls. 30 orgs ≈ 400 calls/day. Well within limit.

## Sync pipeline

New function `syncLinkedInPosts(connection)` in `lib/platforms/linkedin/`, called from the existing daily cron at `/app/api/cron/daily-metrics-sync/route.ts` after the current metrics sync per connection.

**Per run**
1. Fetch posts from the last ~95 days (quarter + buffer).
2. Upsert by `linkedin_urn`. Caption, post_url, post_type immutable after first insert.
3. Refresh analytics counters for posts ≤90 days old (engagement trickles in). Posts >90 days are treated as frozen.
4. Recompute `engagement_rate` when impressions/reactions/comments/shares change.
5. Download thumbnail binary if `thumbnail_path` is null. Upload to Supabase Storage. Concurrency-limit to 5 parallel fetches.
6. Per-org `try/catch` so one failing token/429 doesn't halt the cron.

**Backfill on first deploy:** sync trailing 95 days for every active connection. Orgs that connected mid-quarter get partial coverage — show what exists.

## UI

### Component tree

```
ContentBodySlide                    ← new, in components/reviews/review-deck/
├─ heading "What Resonated"
├─ TopPostGrid
│   └─ TopPostCard × 1..4           ← each card fixed max-width, justify-center parent
│       ├─ Image slot (aspect-locked)
│       │   └─ <img src={signedUrl}> OR <TextPostPlaceholder>
│       ├─ Caption (line-clamp-2, ~90 chars)
│       ├─ Engagement rate (big, deck accent)
│       └─ Micro-row: impressions · total engagements
└─ SlideNarrative                   ← 1–2 sentence AI summary
```

**`TextPostPlaceholder`** — same aspect-ratio box as image slot, indigo→purple gradient background with a large inline quote-mark SVG. No broken-looking empty state.

### Deck wiring

- New `NarrativeBlocks` key: `content_highlights?: string`.
- New `BodySection` variant: `{ key: 'content_highlights', heading: 'What Resonated', kind: 'content' }`.
- Inserted in `BODY_SECTIONS` between `linkedin_insights` and `initiatives`.
- Slide filtered out of `BODY_SECTIONS` when `data.linkedin?.top_posts` is empty/missing — keeps deck count dynamic.

### Print mode

Same grid, simpler card (no hover, no shadow). Thumbnails that fail to load fall back to `<TextPostPlaceholder>` so print output never shows broken-image icons.

## Narrative integration

### Fetcher

Extend `fetchLinkedInData` to query `linkedin_posts`:

```ts
const { data: posts } = await supabase
  .from('linkedin_posts')
  .select('*')
  .eq('organization_id', organizationId)
  .gte('posted_at', periods.main.start)
  .lte('posted_at', periods.main.end)
  .order('engagement_rate', { ascending: false })
  .limit(4)
```

For rows with `thumbnail_path`, generate a 1-year signed URL via `supabase.storage.from('linkedin-post-thumbnails').createSignedUrl(path, 365*24*3600)`. Map rows to `LinkedInTopPost[]`.

### Prompt

New block `content_highlights` in `lib/reviews/narrative/prompts.ts`. Receives the top 4 posts' compact representations (via existing `compactTopPost()` in `lib/reviews/narrative/context.ts`). Asks Claude for a 1–2 sentence summary of what resonated, in the author's voice. Respects the org style memo and author notes like every other block.

### AI originals + learner

New block stored in `ai_originals` alongside other blocks so the style-memo learner can diff human edits to `narrative.content_highlights`.

## Fallbacks

- **Zero qualifying posts** → slide omitted from `BODY_SECTIONS` before render; deck still renders.
- **All posts have zero impressions** (edge case) → slide omitted since engagement rate is undefined.
- **Signed thumbnail URL fails client-side** → `<img onError>` swaps to `<TextPostPlaceholder>`.
- **LinkedIn API sync fails for one org** → logged, other orgs continue. Stale data used until next successful sync.
- **LinkedIn API sync fails globally (outage)** → previous snapshot data still available; narrative regeneration still works on existing DB rows.

## Testing strategy

### Unit

- `lib/platforms/linkedin/posts-sync.test.ts` — mock API responses; verify upsert, analytics refresh-window (≤90 days), engagement_rate math (0 impressions → null), thumbnail-skip when already stored, per-org try/catch isolation.
- `lib/reviews/fetchers/linkedin.test.ts` — extend existing mocks to cover `linkedin_posts`. Verify top-4 by `engagement_rate DESC` within `posted_at` range; maps to `LinkedInTopPost`.
- `components/reviews/review-deck/top-post-grid.test.tsx` — renders 1/2/3/4 cards centered; null on empty array.
- `components/reviews/review-deck/top-post-card.test.tsx` — thumbnail present → `<img>`; null → `<TextPostPlaceholder>`; engagement rate formatted `X.X%`; impressions/engagements use `toLocaleString()`.
- `components/reviews/review-deck/content-body-slide.test.tsx` — heading + grid + narrative; screen vs print mode matches other body slides.
- `lib/reviews/narrative/prompts.test.ts` — `content_highlights` prompt includes style memo + author notes; captions truncated.

### Integration

- Extend review-deck E2E with a seeded org that has 4 posts in `linkedin_posts`. Verify slide renders between LinkedIn tiles and Initiatives with the correct heading and card count.

### Visual

- Add `content-highlights` snapshot to `tests/e2e/visual.spec.ts`. Variants: 4 posts, 2 posts centered, text-only placeholder.

### Manual

- Post-deploy: run the sync cron against staging with a real LinkedIn-connected org. Eyeball thumbnails render, captions are readable, engagement rates look plausible.

## Out of scope

- Top posts across multiple quarters / trend chart of engagement over time
- User ability to pin/override which posts appear
- Comment/reply content analysis
- Post scheduling or publishing
- Analytics for non-organization-owned posts (employee advocacy, etc.)
