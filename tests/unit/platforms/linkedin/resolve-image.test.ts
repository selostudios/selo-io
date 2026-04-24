import { describe, test, expect, afterEach, vi } from 'vitest'
import { LinkedInClient } from '@/lib/platforms/linkedin/client'

const ORG_ID = '12345'

function mockFetchJson(body: unknown) {
  return vi
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
}

function makeClient() {
  return new LinkedInClient({
    access_token: 't',
    refresh_token: 'r',
    organization_id: ORG_ID,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  })
}

describe('LinkedInClient.resolveImageUrl', () => {
  afterEach(() => vi.restoreAllMocks())

  test('returns downloadUrl from /images response', async () => {
    mockFetchJson({
      id: 'urn:li:image:abc',
      downloadUrl: 'https://media.licdn.com/abc.jpg',
    })
    const client = makeClient()

    const url = await client.resolveImageUrl('urn:li:image:abc')

    expect(url).toBe('https://media.licdn.com/abc.jpg')
  })

  test('returns null when downloadUrl missing', async () => {
    mockFetchJson({ id: 'urn:li:image:abc' })
    const client = makeClient()

    const url = await client.resolveImageUrl('urn:li:image:abc')

    expect(url).toBeNull()
  })

  test('URL-encodes the image URN in the request path', async () => {
    const spy = mockFetchJson({
      id: 'urn:li:image:abc',
      downloadUrl: 'https://media.licdn.com/abc.jpg',
    })
    const client = makeClient()

    await client.resolveImageUrl('urn:li:image:abc')

    const calledUrl = spy.mock.calls[0][0] as string
    expect(calledUrl).toContain(encodeURIComponent('urn:li:image:abc'))
    expect(calledUrl).not.toContain('urn:li:image:abc')
  })
})
