import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { aiCrawlerAccess } from '@/lib/geo/checks/technical-foundation/ai-crawler-access'
import type { GEOCheckContext } from '@/lib/geo/types'

describe('aiCrawlerAccess check', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should pass when no robots.txt exists (default allow)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    })
    vi.stubGlobal('fetch', mockFetch)

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe('passed')
    expect(result.details?.message).toContain('No robots.txt found')
  })

  it('should pass when AI crawlers are allowed', async () => {
    const robotsTxt = `
User-agent: *
Disallow: /admin/

User-agent: GPTBot
Allow: /
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => robotsTxt,
    })
    vi.stubGlobal('fetch', mockFetch)

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe('passed')
    expect(result.details?.message).toContain('AI crawlers can access')
  })

  it('should fail when AI crawlers are blocked', async () => {
    const robotsTxt = `
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /
    `

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => robotsTxt,
    })
    vi.stubGlobal('fetch', mockFetch)

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe('failed')
    expect(result.details?.message).toContain('blocks these AI crawlers')
    expect(result.details?.blocked).toContain('GPTBot')
    expect(result.details?.blocked).toContain('ClaudeBot')
  })

  it('should only run on homepage', async () => {
    const context: GEOCheckContext = {
      url: 'https://example.com/blog/post',
      html: '<html></html>',
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe('passed')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should handle fetch errors gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe('warning')
    expect(result.details?.message).toContain('Could not verify robots.txt')
  })
})
