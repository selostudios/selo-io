import { describe, test, expect, afterEach, vi } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

const ORG_ID = '12345'

function mockFetchJson(responses: unknown[]) {
  let i = 0
  return vi.spyOn(global, 'fetch').mockImplementation(async () => {
    const body = responses[i++] ?? { elements: [] }
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

function makeClient() {
  return new LinkedInClient({
    access_token: 't',
    refresh_token: 'r',
    organization_id: ORG_ID,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  })
}

function urlOf(call: Parameters<typeof fetch>) {
  const arg = call[0]
  return typeof arg === 'string' ? arg : arg instanceof URL ? arg.toString() : (arg as Request).url
}

describe('LinkedInClient.getPostAnalytics', () => {
  afterEach(() => vi.restoreAllMocks())

  test('returns a map keyed by post urn with impression/engagement counts', async () => {
    mockFetchJson([
      {
        elements: [
          {
            ugcPost: 'urn:li:ugcPost:1',
            totalShareStatistics: {
              impressionCount: 1000,
              likeCount: 50,
              commentCount: 10,
              shareCount: 5,
            },
          },
          {
            ugcPost: 'urn:li:ugcPost:2',
            totalShareStatistics: {
              impressionCount: 200,
              likeCount: 3,
              commentCount: 1,
              shareCount: 0,
            },
          },
        ],
      },
    ])
    const client = makeClient()

    const result = await client.getPostAnalytics(['urn:li:ugcPost:1', 'urn:li:ugcPost:2'])

    expect(result.size).toBe(2)
    expect(result.get('urn:li:ugcPost:1')).toEqual({
      impressions: 1000,
      reactions: 50,
      comments: 10,
      shares: 5,
    })
    expect(result.get('urn:li:ugcPost:2')).toEqual({
      impressions: 200,
      reactions: 3,
      comments: 1,
      shares: 0,
    })
  })

  test('uses Restli List(...) syntax with the ugcPosts param for ugcPost urns', async () => {
    const spy = mockFetchJson([{ elements: [] }])
    const client = makeClient()

    await client.getPostAnalytics(['urn:li:ugcPost:1', 'urn:li:ugcPost:2'])

    expect(spy).toHaveBeenCalledTimes(1)
    const url = urlOf(spy.mock.calls[0] as Parameters<typeof fetch>)
    expect(url).toContain('ugcPosts=List(urn%3Ali%3AugcPost%3A1,urn%3Ali%3AugcPost%3A2)')
    expect(url).not.toContain('shares=')
    expect(url).not.toContain('shares[]')
  })

  test('uses the shares param for legacy share urns', async () => {
    const spy = mockFetchJson([{ elements: [] }])
    const client = makeClient()

    await client.getPostAnalytics(['urn:li:share:9001'])

    expect(spy).toHaveBeenCalledTimes(1)
    const url = urlOf(spy.mock.calls[0] as Parameters<typeof fetch>)
    expect(url).toContain('shares=List(urn%3Ali%3Ashare%3A9001)')
    expect(url).not.toContain('ugcPosts=')
  })

  test('splits mixed urn types across separate requests by param name', async () => {
    const spy = mockFetchJson([{ elements: [] }, { elements: [] }])
    const client = makeClient()

    await client.getPostAnalytics([
      'urn:li:share:1',
      'urn:li:ugcPost:2',
      'urn:li:share:3',
      'urn:li:ugcPost:4',
    ])

    expect(spy).toHaveBeenCalledTimes(2)
    const urls = spy.mock.calls.map((c) => urlOf(c as Parameters<typeof fetch>))
    const sharesCall = urls.find((u) => u.includes('shares=List('))
    const ugcCall = urls.find((u) => u.includes('ugcPosts=List('))
    expect(sharesCall).toBeDefined()
    expect(ugcCall).toBeDefined()
    expect(sharesCall).toContain('urn%3Ali%3Ashare%3A1')
    expect(sharesCall).toContain('urn%3Ali%3Ashare%3A3')
    expect(ugcCall).toContain('urn%3Ali%3AugcPost%3A2')
    expect(ugcCall).toContain('urn%3Ali%3AugcPost%3A4')
  })

  test('batches up to 50 urns per request', async () => {
    const spy = mockFetchJson([{ elements: [] }, { elements: [] }, { elements: [] }])
    const client = makeClient()

    const urns = Array.from({ length: 120 }, (_, i) => `urn:li:ugcPost:${i + 1}`)
    await client.getPostAnalytics(urns)

    expect(spy).toHaveBeenCalledTimes(3)
  })

  test('does not call fetch when postUrns is empty', async () => {
    const spy = vi.spyOn(global, 'fetch')
    const client = makeClient()

    const result = await client.getPostAnalytics([])

    expect(result.size).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })

  test('skips urns with unrecognized prefixes', async () => {
    const spy = vi.spyOn(global, 'fetch')
    const client = makeClient()

    const result = await client.getPostAnalytics(['urn:li:activity:42'])

    expect(result.size).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })
})
