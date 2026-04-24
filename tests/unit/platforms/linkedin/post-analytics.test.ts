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

describe('LinkedInClient.getPostAnalytics', () => {
  afterEach(() => vi.restoreAllMocks())

  test('returns a map keyed by post urn with impression/engagement counts', async () => {
    mockFetchJson([
      {
        elements: [
          {
            share: 'urn:li:ugcPost:1',
            totalShareStatistics: {
              impressionCount: 1000,
              likeCount: 50,
              commentCount: 10,
              shareCount: 5,
            },
          },
          {
            share: 'urn:li:ugcPost:2',
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
})
