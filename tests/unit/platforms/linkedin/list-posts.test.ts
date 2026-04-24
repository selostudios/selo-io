import { describe, test, expect, afterEach, vi } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

const ORG_ID = '12345'
const ORG_URN = 'urn:li:organization:12345'

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

describe('LinkedInClient.listPosts', () => {
  afterEach(() => vi.restoreAllMocks())

  test('returns posts within the date window and stops paginating when older', async () => {
    const now = Date.now()
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
    const client = makeClient()

    const posts = await client.listPosts({
      orgUrn: ORG_URN,
      since: new Date(now - 95 * oneDay),
    })

    expect(posts).toHaveLength(2)
    expect(posts[0].id).toBe('urn:li:ugcPost:1')
  })

  test('filters out posts older than the window', async () => {
    const now = Date.now()
    const oneDay = 86_400_000
    mockFetchJson([
      {
        elements: [
          { id: 'urn:li:ugcPost:1', createdAt: now - 10 * oneDay },
          { id: 'urn:li:ugcPost:2', createdAt: now - 200 * oneDay },
        ],
      },
    ])
    const client = makeClient()

    const posts = await client.listPosts({
      orgUrn: ORG_URN,
      since: new Date(now - 95 * oneDay),
    })

    expect(posts.map((p) => p.id)).toEqual(['urn:li:ugcPost:1'])
  })

  test('follows next links across multiple pages and accumulates posts in order', async () => {
    const now = Date.now()
    const oneDay = 86_400_000
    const spy = mockFetchJson([
      {
        elements: [
          { id: 'urn:li:ugcPost:1', createdAt: now - 1 * oneDay },
          { id: 'urn:li:ugcPost:2', createdAt: now - 2 * oneDay },
        ],
        paging: {
          start: 0,
          count: 2,
          links: [{ rel: 'next', href: '/posts?start=2' }],
        },
      },
      {
        elements: [
          { id: 'urn:li:ugcPost:3', createdAt: now - 3 * oneDay },
          { id: 'urn:li:ugcPost:4', createdAt: now - 4 * oneDay },
        ],
        paging: {
          start: 2,
          count: 2,
          links: [{ rel: 'next', href: '/posts?start=4' }],
        },
      },
      {
        elements: [{ id: 'urn:li:ugcPost:5', createdAt: now - 5 * oneDay }],
        paging: { start: 4, count: 1 },
      },
    ])
    const client = makeClient()

    const posts = await client.listPosts({
      orgUrn: ORG_URN,
      since: new Date(now - 95 * oneDay),
    })

    expect(posts.map((p) => p.id)).toEqual([
      'urn:li:ugcPost:1',
      'urn:li:ugcPost:2',
      'urn:li:ugcPost:3',
      'urn:li:ugcPost:4',
      'urn:li:ugcPost:5',
    ])
    expect(spy).toHaveBeenCalledTimes(3)
  })

  test('stops paginating once maxPages is reached', async () => {
    const now = Date.now()
    const oneDay = 86_400_000
    let counter = 0
    const spy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
      counter++
      const body = {
        elements: [
          {
            id: `urn:li:ugcPost:${counter}a`,
            createdAt: now - counter * oneDay,
          },
          {
            id: `urn:li:ugcPost:${counter}b`,
            createdAt: now - (counter + 0.5) * oneDay,
          },
        ],
        paging: {
          start: (counter - 1) * 2,
          count: 2,
          // Always advertise another page so maxPages is the only stop.
          links: [{ rel: 'next', href: `/posts?start=${counter * 2}` }],
        },
      }
      return new Response(JSON.stringify(body), { status: 200 })
    })
    const client = makeClient()

    const posts = await client.listPosts({
      orgUrn: ORG_URN,
      since: new Date(now - 95 * oneDay),
      maxPages: 2,
    })

    expect(spy).toHaveBeenCalledTimes(2)
    expect(posts).toHaveLength(4)
    expect(posts.map((p) => p.id)).toEqual([
      'urn:li:ugcPost:1a',
      'urn:li:ugcPost:1b',
      'urn:li:ugcPost:2a',
      'urn:li:ugcPost:2b',
    ])
  })
})
