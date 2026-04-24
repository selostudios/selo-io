import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

import { fetchLinkedInData } from '@/lib/reviews/fetchers/linkedin'
import { LINKEDIN_FEATURED_METRIC_KEYS } from '@/lib/reviews/linkedin-featured-metrics'
import { createServiceClient } from '@/lib/supabase/server'

type Row = { metric_type: string; date: string; value: number }

type PostRow = {
  linkedin_urn: string
  post_url: string | null
  thumbnail_path: string | null
  caption: string | null
  posted_at: string
  impressions: number | string
  reactions: number | string
  comments: number | string
  shares: number | string
  engagement_rate: number | string | null
}

type SignedUrlResponse = {
  data: { signedUrl: string } | null
  error: Error | null
}

type SignedUrlBehaviour =
  | { kind: 'success' }
  | { kind: 'error'; error: Error }
  | ((path: string, ttl: number) => Promise<SignedUrlResponse>)

type PostsQueryResult = {
  data: PostRow[] | null
  error: Error | null
}

function makeMetricsChain(rowsByStart: Record<string, Row[]>, defaultRows: Row[] = []) {
  let capturedStart: string | null = null
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    gte: vi.fn((_col: string, val: string) => {
      capturedStart = val
      return chain
    }),
    lte: vi.fn(() => chain),
    order: vi.fn(() => chain),
    then: (resolve: (r: { data: Row[]; error: null }) => unknown) => {
      const rows =
        capturedStart !== null ? (rowsByStart[capturedStart] ?? defaultRows) : defaultRows
      return resolve({ data: rows, error: null })
    },
  }
  return chain
}

function makeConnectionChain(connectionRow: { id: string } | null) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => ({ data: connectionRow, error: null })),
  }
  return chain
}

function makePostsChain(result: PostsQueryResult) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: (r: PostsQueryResult) => unknown) => resolve(result),
  }
  return chain
}

function makeSupabaseFake(opts: {
  rowsByStart?: Record<string, Row[]>
  connection?: { id: string } | null
  postsResult?: PostsQueryResult
  signedUrlBehaviour?: SignedUrlBehaviour
}) {
  const rowsByStart = opts.rowsByStart ?? {}
  const connection = opts.connection === undefined ? { id: 'conn-1' } : opts.connection
  const postsResult = opts.postsResult ?? { data: [], error: null }
  const signedUrlBehaviour = opts.signedUrlBehaviour ?? { kind: 'success' }

  const createSignedUrl = vi.fn(async (path: string, ttl: number): Promise<SignedUrlResponse> => {
    if (typeof signedUrlBehaviour === 'function') {
      return signedUrlBehaviour(path, ttl)
    }
    if (signedUrlBehaviour.kind === 'success') {
      return { data: { signedUrl: `https://signed/${path}?token=abc` }, error: null }
    }
    return { data: null, error: signedUrlBehaviour.error }
  })

  const storageFrom = vi.fn(() => ({ createSignedUrl }))

  vi.mocked(createServiceClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'platform_connections') return makeConnectionChain(connection)
      if (table === 'linkedin_posts') return makePostsChain(postsResult)
      return makeMetricsChain(rowsByStart)
    }),
    storage: { from: storageFrom },
  } as never)

  return { createSignedUrl, storageFrom }
}

const periods = {
  main: { start: '2026-01-01', end: '2026-03-31' },
  qoq: { start: '2025-10-01', end: '2025-12-31' },
  yoy: { start: '2025-01-01', end: '2025-03-31' },
}

const mainRows: Row[] = [
  { metric_type: 'linkedin_impressions', date: '2026-01-01', value: 1000 },
  { metric_type: 'linkedin_impressions', date: '2026-01-02', value: 1500 },
  { metric_type: 'linkedin_follower_growth', date: '2026-01-01', value: 10 },
  { metric_type: 'linkedin_follower_growth', date: '2026-01-02', value: 15 },
  { metric_type: 'linkedin_page_views', date: '2026-01-01', value: 200 },
  { metric_type: 'linkedin_page_views', date: '2026-01-02', value: 250 },
  { metric_type: 'linkedin_followers', date: '2026-01-01', value: 500 },
  { metric_type: 'linkedin_followers', date: '2026-01-02', value: 525 },
  { metric_type: 'linkedin_reactions', date: '2026-01-01', value: 30 },
]

const qoqRows: Row[] = [
  { metric_type: 'linkedin_impressions', date: '2025-10-01', value: 800 },
  { metric_type: 'linkedin_impressions', date: '2025-10-02', value: 900 },
  { metric_type: 'linkedin_follower_growth', date: '2025-10-01', value: 8 },
  { metric_type: 'linkedin_page_views', date: '2025-10-01', value: 150 },
]

const yoyRows: Row[] = [
  { metric_type: 'linkedin_impressions', date: '2025-01-01', value: 600 },
  { metric_type: 'linkedin_follower_growth', date: '2025-01-01', value: 5 },
  { metric_type: 'linkedin_page_views', date: '2025-01-01', value: 100 },
]

const defaultRowsByStart: Record<string, Row[]> = {
  [periods.main.start]: mainRows,
  [periods.qoq.start]: qoqRows,
  [periods.yoy.start]: yoyRows,
}

describe('fetchLinkedInData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    makeSupabaseFake({ rowsByStart: defaultRowsByStart })
  })

  test('returns undefined when the organization has no active LinkedIn connection', async () => {
    makeSupabaseFake({ connection: null })
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeUndefined()
  })

  test('attaches daily timeseries with {date, value} rows to every featured metric', async () => {
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeDefined()

    for (const key of LINKEDIN_FEATURED_METRIC_KEYS) {
      const triple = data!.metrics[key]
      expect(triple, `expected triple for featured metric ${key}`).toBeDefined()
      expect(triple.timeseries, `expected timeseries on ${key}`).toBeDefined()
      const ts = triple.timeseries!

      for (const period of ['current', 'qoq', 'yoy'] as const) {
        expect(Array.isArray(ts[period])).toBe(true)
        for (const row of ts[period]) {
          expect(typeof row.date).toBe('string')
          expect(typeof row.value).toBe('number')
        }
      }
    }

    const impressions = data!.metrics['linkedin_impressions'].timeseries!
    expect(impressions.current).toEqual([
      { date: '2026-01-01', value: 1000 },
      { date: '2026-01-02', value: 1500 },
    ])
  })

  test('does not attach timeseries to non-featured metrics', async () => {
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeDefined()

    const featured = new Set<string>(LINKEDIN_FEATURED_METRIC_KEYS)
    for (const [key, triple] of Object.entries(data!.metrics)) {
      if (featured.has(key)) continue
      expect(
        triple.timeseries,
        `expected no timeseries on non-featured metric ${key}`
      ).toBeUndefined()
    }
  })

  test('scalar fields on featured metrics reflect summed values and deltas', async () => {
    const data = await fetchLinkedInData('org-1', periods)
    expect(data).toBeDefined()

    const impressions = data!.metrics['linkedin_impressions']
    expect(impressions.current).toBe(2500)
    expect(impressions.qoq).toBe(1700)
    expect(impressions.yoy).toBe(600)

    const growth = data!.metrics['linkedin_follower_growth']
    expect(growth.current).toBe(25)

    const followers = data!.metrics['linkedin_followers']
    expect(followers.current).toBe(525)
  })

  describe('top_posts', () => {
    afterEach(() => {
      vi.clearAllMocks()
    })

    test('returns top 4 posts sorted by engagement rate with signed thumbnail URLs', async () => {
      const posts: PostRow[] = [
        {
          linkedin_urn: 'urn:li:share:1',
          post_url: 'https://linkedin.com/feed/update/urn:li:share:1',
          thumbnail_path: 'org-1/urn-li-share-1.jpg',
          caption: 'Highest engagement post',
          posted_at: '2026-02-15T12:00:00.000Z',
          impressions: '5000',
          reactions: '200',
          comments: '50',
          shares: '10',
          engagement_rate: '0.052',
        },
        {
          linkedin_urn: 'urn:li:share:2',
          post_url: 'https://linkedin.com/feed/update/urn:li:share:2',
          thumbnail_path: 'org-1/urn-li-share-2.jpg',
          caption: 'Second best',
          posted_at: '2026-02-10T12:00:00.000Z',
          impressions: 4000,
          reactions: 120,
          comments: 30,
          shares: 8,
          engagement_rate: 0.039,
        },
        {
          linkedin_urn: 'urn:li:share:3',
          post_url: 'https://linkedin.com/feed/update/urn:li:share:3',
          thumbnail_path: 'org-1/urn-li-share-3.jpg',
          caption: 'Third',
          posted_at: '2026-01-20T12:00:00.000Z',
          impressions: 3000,
          reactions: 80,
          comments: 20,
          shares: 5,
          engagement_rate: 0.035,
        },
        {
          linkedin_urn: 'urn:li:share:4',
          post_url: 'https://linkedin.com/feed/update/urn:li:share:4',
          thumbnail_path: 'org-1/urn-li-share-4.jpg',
          caption: 'Fourth',
          posted_at: '2026-01-05T12:00:00.000Z',
          impressions: 2500,
          reactions: 60,
          comments: 15,
          shares: 4,
          engagement_rate: 0.031,
        },
      ]
      const { createSignedUrl } = makeSupabaseFake({
        rowsByStart: defaultRowsByStart,
        postsResult: { data: posts, error: null },
      })

      const data = await fetchLinkedInData('org-1', periods)
      expect(data).toBeDefined()
      expect(data!.top_posts).toBeDefined()
      expect(data!.top_posts!.length).toBe(4)

      const first = data!.top_posts![0]
      expect(first.id).toBe('urn:li:share:1')
      expect(first.url).toBe('https://linkedin.com/feed/update/urn:li:share:1')
      expect(first.caption).toBe('Highest engagement post')
      expect(first.posted_at).toBe('2026-02-15T12:00:00.000Z')
      expect(first.thumbnail_url).toBe('https://signed/org-1/urn-li-share-1.jpg?token=abc')
      expect(first.impressions).toBe(5000)
      expect(first.reactions).toBe(200)
      expect(first.comments).toBe(50)
      expect(first.shares).toBe(10)
      expect(first.engagement_rate).toBeCloseTo(0.052)

      expect(createSignedUrl).toHaveBeenCalledTimes(4)
      for (const call of createSignedUrl.mock.calls) {
        expect(call[1]).toBe(365 * 24 * 3600)
      }
    })

    test('omits thumbnail_url for posts without a thumbnail_path', async () => {
      const posts: PostRow[] = [
        {
          linkedin_urn: 'urn:li:share:text',
          post_url: 'https://linkedin.com/feed/update/urn:li:share:text',
          thumbnail_path: null,
          caption: 'Text only post',
          posted_at: '2026-02-15T12:00:00.000Z',
          impressions: 1000,
          reactions: 50,
          comments: 5,
          shares: 1,
          engagement_rate: 0.056,
        },
        {
          linkedin_urn: 'urn:li:share:image',
          post_url: 'https://linkedin.com/feed/update/urn:li:share:image',
          thumbnail_path: 'org-1/image.jpg',
          caption: 'Image post',
          posted_at: '2026-02-10T12:00:00.000Z',
          impressions: 2000,
          reactions: 60,
          comments: 10,
          shares: 2,
          engagement_rate: 0.036,
        },
      ]
      const { createSignedUrl } = makeSupabaseFake({
        rowsByStart: defaultRowsByStart,
        postsResult: { data: posts, error: null },
      })

      const data = await fetchLinkedInData('org-1', periods)
      expect(data!.top_posts![0].thumbnail_url).toBeNull()
      expect(data!.top_posts![1].thumbnail_url).toBe('https://signed/org-1/image.jpg?token=abc')
      expect(createSignedUrl).toHaveBeenCalledTimes(1)
    })

    test('returns empty array when no posts qualify', async () => {
      const { createSignedUrl } = makeSupabaseFake({
        rowsByStart: defaultRowsByStart,
        postsResult: { data: [], error: null },
      })

      const data = await fetchLinkedInData('org-1', periods)
      expect(data!.top_posts).toEqual([])
      expect(createSignedUrl).not.toHaveBeenCalled()
    })

    test('returns empty array if query errors out', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      makeSupabaseFake({
        rowsByStart: defaultRowsByStart,
        postsResult: { data: null, error: new Error('db down') },
      })

      const data = await fetchLinkedInData('org-1', periods)
      expect(data!.top_posts).toEqual([])
      expect(errorSpy).toHaveBeenCalledWith(
        '[Reviews] linkedin top posts query failed',
        expect.any(Object)
      )
      errorSpy.mockRestore()
    })

    test('returns null thumbnail when createSignedUrl fails', async () => {
      const posts: PostRow[] = [
        {
          linkedin_urn: 'urn:li:share:1',
          post_url: null,
          thumbnail_path: 'org-1/broken.jpg',
          caption: 'Broken storage post',
          posted_at: '2026-02-15T12:00:00.000Z',
          impressions: 1000,
          reactions: 40,
          comments: 5,
          shares: 1,
          engagement_rate: 0.046,
        },
      ]
      makeSupabaseFake({
        rowsByStart: defaultRowsByStart,
        postsResult: { data: posts, error: null },
        signedUrlBehaviour: { kind: 'error', error: new Error('storage down') },
      })

      const data = await fetchLinkedInData('org-1', periods)
      expect(data!.top_posts!.length).toBe(1)
      expect(data!.top_posts![0].thumbnail_url).toBeNull()
      expect(data!.top_posts![0].url).toBeNull()
    })
  })
})
