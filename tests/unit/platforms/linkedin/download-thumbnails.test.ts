import { describe, test, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { downloadThumbnails } from '@/lib/platforms/linkedin/download-thumbnails'

type UploadBehaviour = 'ok' | 'fail'

function fakeSupabase(uploadBehaviour: UploadBehaviour = 'ok') {
  const uploads: string[] = []
  const bucketCalls: string[] = []
  return {
    uploads,
    bucketCalls,
    storage: {
      from: (bucket: string) => {
        bucketCalls.push(bucket)
        return {
          upload: vi.fn(async (path: string) => {
            uploads.push(path)
            return uploadBehaviour === 'ok'
              ? { data: { path }, error: null }
              : { data: null, error: new Error('boom') }
          }),
        }
      },
    },
  }
}

describe('downloadThumbnails', () => {
  afterEach(() => vi.restoreAllMocks())

  test('uploads each thumbnail to {org}/{urn}.jpg and returns the map', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )
    const sb = fakeSupabase('ok')
    const result = await downloadThumbnails(sb as unknown as SupabaseClient, [
      {
        organizationId: 'org1',
        linkedinUrn: 'urn:li:ugcPost:1',
        imageCdnUrl: 'https://media.licdn.com/a.jpg',
      },
    ])
    expect(result.get('urn:li:ugcPost:1')).toBe('org1/urn:li:ugcPost:1.jpg')
    expect(sb.uploads).toEqual(['org1/urn:li:ugcPost:1.jpg'])
    expect(sb.bucketCalls).toContain('linkedin-post-thumbnails')
  })

  test('skips failed uploads without throwing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )
    const sb = fakeSupabase('fail')
    const result = await downloadThumbnails(sb as unknown as SupabaseClient, [
      {
        organizationId: 'org1',
        linkedinUrn: 'urn:li:ugcPost:1',
        imageCdnUrl: 'https://media.licdn.com/a.jpg',
      },
    ])
    expect(result.size).toBe(0)
  })

  test('skips jobs where the image CDN fetch fails', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 404 }))
    const sb = fakeSupabase('ok')
    const result = await downloadThumbnails(sb as unknown as SupabaseClient, [
      {
        organizationId: 'org1',
        linkedinUrn: 'urn:li:ugcPost:1',
        imageCdnUrl: 'https://media.licdn.com/missing.jpg',
      },
    ])
    expect(result.size).toBe(0)
    expect(sb.uploads).toEqual([])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('logs and continues when the network fetch throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sb = fakeSupabase('ok')

    const result = await downloadThumbnails(sb as unknown as SupabaseClient, [
      {
        organizationId: 'org1',
        linkedinUrn: 'urn:li:ugcPost:1',
        imageCdnUrl: 'https://media.licdn.com/a.jpg',
      },
      {
        organizationId: 'org1',
        linkedinUrn: 'urn:li:ugcPost:2',
        imageCdnUrl: 'https://media.licdn.com/b.jpg',
      },
    ])

    expect(result.size).toBe(0)
    expect(sb.uploads).toEqual([])
    expect(errorSpy).toHaveBeenCalled()
  })

  test('processes more jobs than the concurrency limit without dropping any', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )
    const sb = fakeSupabase('ok')
    const jobs = Array.from({ length: 12 }, (_, i) => ({
      organizationId: 'org1',
      linkedinUrn: `urn:li:ugcPost:${i}`,
      imageCdnUrl: `https://media.licdn.com/${i}.jpg`,
    }))

    const result = await downloadThumbnails(sb as unknown as SupabaseClient, jobs)

    expect(result.size).toBe(12)
    for (let i = 0; i < 12; i++) {
      expect(result.get(`urn:li:ugcPost:${i}`)).toBe(`org1/urn:li:ugcPost:${i}.jpg`)
    }
    expect(sb.uploads).toHaveLength(12)
  })

  test('caps parallelism at 5 concurrent fetches', async () => {
    let active = 0
    let peak = 0
    const release: Array<() => void> = []
    vi.spyOn(global, 'fetch').mockImplementation(() => {
      active += 1
      peak = Math.max(peak, active)
      return new Promise<Response>((resolve) => {
        release.push(() => {
          active -= 1
          resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
        })
      })
    })
    const sb = fakeSupabase('ok')
    const jobs = Array.from({ length: 12 }, (_, i) => ({
      organizationId: 'org1',
      linkedinUrn: `urn:li:ugcPost:${i}`,
      imageCdnUrl: `https://media.licdn.com/${i}.jpg`,
    }))

    const promise = downloadThumbnails(sb as unknown as SupabaseClient, jobs)

    // Let workers kick off and queue up initial fetches.
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    expect(peak).toBeLessThanOrEqual(5)
    expect(peak).toBe(5)

    // Release all in flight and let the pool drain.
    while (release.length > 0) {
      release.shift()?.()
      await new Promise((r) => setTimeout(r, 0))
    }
    const result = await promise
    expect(result.size).toBe(12)
  })

  test('returns empty map for empty input without calling fetch', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
    const sb = fakeSupabase('ok')
    const result = await downloadThumbnails(sb as unknown as SupabaseClient, [])
    expect(result.size).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(sb.uploads).toEqual([])
  })
})
