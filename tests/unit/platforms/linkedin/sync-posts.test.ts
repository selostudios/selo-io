import { describe, test, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LinkedInRawPost, PostAnalytics } from '@/lib/platforms/linkedin/client'
import { syncLinkedInPosts } from '@/lib/platforms/linkedin/actions'

// Hoisted mocks so they can be referenced by vi.mock factories.
const mocks = vi.hoisted(() => ({
  listPosts: vi.fn(),
  getPostAnalytics: vi.fn(),
  resolveImageUrl: vi.fn(),
  downloadThumbnails: vi.fn(),
}))

vi.mock('@/lib/platforms/linkedin/client', () => ({
  LinkedInClient: class {
    listPosts = mocks.listPosts
    getPostAnalytics = mocks.getPostAnalytics
    resolveImageUrl = mocks.resolveImageUrl
  },
}))

vi.mock('@/lib/platforms/linkedin/download-thumbnails', () => ({
  downloadThumbnails: mocks.downloadThumbnails,
}))

vi.mock('@/lib/utils/crypto', () => ({
  decryptCredentials: <T>(x: T) => x,
}))

// Supabase fake. The actions code only uses a small slice of the client:
//   - .from(table).upsert(rows, opts)
//   - .from(table).select(...).eq(...).gte(...)
//   - .from(table).update(row).match(filter)
// We record calls so tests can assert on them.
interface SupabaseCalls {
  upsert: { rows: Record<string, unknown>[]; opts: Record<string, unknown> }[]
  updates: { filter: Record<string, unknown>; row: Record<string, unknown> }[]
  selects: { columns: string; filters: Record<string, unknown> }[]
}

interface FakeOptions {
  upsertError?: Error | null
  existingRows?: Array<{
    linkedin_urn: string
    posted_at: string
    post_type: string
    thumbnail_path: string | null
  }>
}

function makeFakeSupabase(options: FakeOptions = {}) {
  const calls: SupabaseCalls = { upsert: [], updates: [], selects: [] }

  const from = () => ({
    upsert: (rows: Record<string, unknown>[], opts: Record<string, unknown>) => {
      calls.upsert.push({ rows, opts })
      return Promise.resolve({ error: options.upsertError ?? null })
    },
    select: (columns: string) => {
      const capture: { filters: Record<string, unknown> } = { filters: {} }
      calls.selects.push({ columns, filters: capture.filters })
      const builder = {
        eq(key: string, value: unknown) {
          capture.filters[key] = value
          return builder
        },
        gte(key: string, value: unknown) {
          capture.filters[`gte:${key}`] = value
          return builder
        },
        in(key: string, value: unknown) {
          capture.filters[`in:${key}`] = value
          return builder
        },
        then(resolve: (r: { data: FakeOptions['existingRows']; error: null }) => unknown) {
          return Promise.resolve({ data: options.existingRows ?? [], error: null }).then(resolve)
        },
      }
      return builder
    },
    update: (row: Record<string, unknown>) => ({
      match: (filter: Record<string, unknown>) => {
        calls.updates.push({ filter, row })
        return Promise.resolve({ error: null })
      },
    }),
  })

  const supabase = { from } as unknown as SupabaseClient
  return { supabase, calls }
}

const credentials = {
  encrypted: {
    access_token: 'tok',
    refresh_token: 'rtok',
    organization_id: '12345',
  },
}

function makeRawPost(overrides: Partial<LinkedInRawPost> = {}): LinkedInRawPost {
  return {
    id: 'urn:li:ugcPost:1',
    createdAt: Date.now() - 1_000_000,
    commentary: 'Hello world',
    content: { media: { id: 'urn:li:image:abc' } },
    ...overrides,
  }
}

describe('syncLinkedInPosts', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('upserts posts derived from raw LinkedIn response', async () => {
    const raw = makeRawPost()
    mocks.listPosts.mockResolvedValue([raw])
    mocks.getPostAnalytics.mockResolvedValue(
      new Map<string, PostAnalytics>([
        [raw.id, { impressions: 100, reactions: 5, comments: 2, shares: 1 }],
      ])
    )
    mocks.resolveImageUrl.mockResolvedValue('https://cdn.li/a.jpg')
    mocks.downloadThumbnails.mockResolvedValue(new Map([[raw.id, 'org1/urn:li:ugcPost:1.jpg']]))
    const { supabase, calls } = makeFakeSupabase({
      existingRows: [
        {
          linkedin_urn: raw.id,
          posted_at: new Date(raw.createdAt!).toISOString(),
          post_type: 'image',
          thumbnail_path: null,
        },
      ],
    })

    await syncLinkedInPosts('conn1', 'org1', credentials, supabase)

    expect(calls.upsert).toHaveLength(1)
    expect(calls.upsert[0].opts).toEqual({ onConflict: 'organization_id,linkedin_urn' })
    const row = calls.upsert[0].rows[0]
    expect(row).toMatchObject({
      organization_id: 'org1',
      platform_connection_id: 'conn1',
      linkedin_urn: raw.id,
      post_type: 'image',
      caption: 'Hello world',
      post_url: `https://www.linkedin.com/feed/update/${raw.id}`,
    })
    expect(typeof row.posted_at).toBe('string')
  })

  test('refreshes engagement metrics for posts in the sync window', async () => {
    const raw = makeRawPost({ id: 'urn:li:ugcPost:42' })
    mocks.listPosts.mockResolvedValue([raw])
    mocks.getPostAnalytics.mockResolvedValue(
      new Map<string, PostAnalytics>([
        [raw.id, { impressions: 200, reactions: 8, comments: 4, shares: 2 }],
      ])
    )
    mocks.resolveImageUrl.mockResolvedValue('https://cdn.li/x.jpg')
    mocks.downloadThumbnails.mockResolvedValue(new Map())
    const { supabase, calls } = makeFakeSupabase({
      existingRows: [
        {
          linkedin_urn: raw.id,
          posted_at: new Date(raw.createdAt!).toISOString(),
          post_type: 'image',
          thumbnail_path: 'already/here.jpg',
        },
      ],
    })

    await syncLinkedInPosts('conn1', 'org1', credentials, supabase)

    expect(mocks.getPostAnalytics).toHaveBeenCalledTimes(1)
    expect(mocks.getPostAnalytics).toHaveBeenCalledWith([raw.id])

    // One update for analytics (thumbnail already set).
    const analyticsUpdate = calls.updates.find((u) => u.row.impressions !== undefined)
    expect(analyticsUpdate).toBeDefined()
    expect(analyticsUpdate!.row).toMatchObject({
      impressions: 200,
      reactions: 8,
      comments: 4,
      shares: 2,
    })
    // engagements / impressions = (8 + 4 + 2) / 200 = 0.07
    expect(analyticsUpdate!.row.engagement_rate).toBeCloseTo(0.07)
    expect(analyticsUpdate!.row.analytics_updated_at).toEqual(expect.any(String))
    expect(analyticsUpdate!.filter).toEqual({
      organization_id: 'org1',
      linkedin_urn: raw.id,
    })
  })

  test('stores a thumbnail for image posts that do not yet have one', async () => {
    const raw = makeRawPost({
      id: 'urn:li:ugcPost:thumb',
      content: { media: { id: 'urn:li:image:xyz' } },
    })
    mocks.listPosts.mockResolvedValue([raw])
    mocks.getPostAnalytics.mockResolvedValue(
      new Map<string, PostAnalytics>([
        [raw.id, { impressions: 50, reactions: 1, comments: 0, shares: 0 }],
      ])
    )
    mocks.resolveImageUrl.mockResolvedValue('https://cdn.li/resolved.jpg')
    mocks.downloadThumbnails.mockResolvedValue(new Map([[raw.id, 'org1/urn:li:ugcPost:thumb.jpg']]))
    const { supabase, calls } = makeFakeSupabase({
      existingRows: [
        {
          linkedin_urn: raw.id,
          posted_at: new Date(raw.createdAt!).toISOString(),
          post_type: 'image',
          thumbnail_path: null,
        },
      ],
    })

    await syncLinkedInPosts('conn1', 'org1', credentials, supabase)

    expect(mocks.resolveImageUrl).toHaveBeenCalledWith('urn:li:image:xyz')
    expect(mocks.downloadThumbnails).toHaveBeenCalledTimes(1)
    const jobs = mocks.downloadThumbnails.mock.calls[0][1] as Array<{
      organizationId: string
      linkedinUrn: string
      imageCdnUrl: string
    }>
    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toEqual({
      organizationId: 'org1',
      linkedinUrn: raw.id,
      imageCdnUrl: 'https://cdn.li/resolved.jpg',
    })

    const thumbUpdate = calls.updates.find((u) => u.row.thumbnail_path !== undefined)
    expect(thumbUpdate).toBeDefined()
    expect(thumbUpdate!.row).toEqual({ thumbnail_path: 'org1/urn:li:ugcPost:thumb.jpg' })
    expect(thumbUpdate!.filter).toEqual({
      organization_id: 'org1',
      linkedin_urn: raw.id,
    })
  })

  test('skips posts without createdAt', async () => {
    const valid = makeRawPost({ id: 'urn:li:ugcPost:good' })
    const missing = makeRawPost({ id: 'urn:li:ugcPost:bad', createdAt: undefined })
    mocks.listPosts.mockResolvedValue([valid, missing])
    mocks.getPostAnalytics.mockResolvedValue(new Map())
    mocks.resolveImageUrl.mockResolvedValue(null)
    mocks.downloadThumbnails.mockResolvedValue(new Map())
    const { supabase, calls } = makeFakeSupabase()

    await syncLinkedInPosts('conn1', 'org1', credentials, supabase)

    expect(calls.upsert).toHaveLength(1)
    expect(calls.upsert[0].rows).toHaveLength(1)
    expect(calls.upsert[0].rows[0].linkedin_urn).toBe('urn:li:ugcPost:good')
  })

  test('does not throw if upsert fails', async () => {
    mocks.listPosts.mockResolvedValue([makeRawPost()])
    mocks.getPostAnalytics.mockResolvedValue(new Map())
    mocks.resolveImageUrl.mockResolvedValue(null)
    mocks.downloadThumbnails.mockResolvedValue(new Map())
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { supabase, calls } = makeFakeSupabase({ upsertError: new Error('boom') })

    await expect(syncLinkedInPosts('conn1', 'org1', credentials, supabase)).resolves.toBeUndefined()

    expect(calls.upsert).toHaveLength(1)
    expect(calls.updates).toHaveLength(0)
    expect(mocks.getPostAnalytics).not.toHaveBeenCalled()
    expect(mocks.downloadThumbnails).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalled()
  })
})
