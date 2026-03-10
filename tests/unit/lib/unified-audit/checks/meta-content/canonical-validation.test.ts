import { describe, it, expect, vi, beforeEach } from 'vitest'
import { canonicalValidation } from '@/lib/unified-audit/checks/meta-content/canonical-validation'
import type { CheckContext } from '@/lib/unified-audit/types'

function makeContext(html: string, url = 'https://example.com/page'): CheckContext {
  return {
    url,
    html,
    title: undefined,
    statusCode: 200,
    allPages: [],
  }
}

describe('canonicalValidation check', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('should pass when no canonical tag exists (handled by separate check)', async () => {
    const result = await canonicalValidation.run(makeContext('<html><head></head></html>'))

    expect(result.status).toBe('passed')
  })

  it('should fail when canonical URL is unreachable due to malformed-like URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Invalid URL'))

    const result = await canonicalValidation.run(
      makeContext(
        '<html><head><link rel="canonical" href="https://example.com/page"></head></html>',
        'https://example.com/page'
      )
    )

    expect(result.status).toBe('failed')
    expect(result.details?.message).toContain('Could not verify')
  })

  it('should pass when canonical is self-referencing and accessible', async () => {
    const url = 'https://example.com/page'
    const html = `<html><head><link rel="canonical" href="${url}"></head></html>`

    // Mock fetch: HEAD returns 200, GET returns page with same canonical
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(`<html><head><link rel="canonical" href="${url}"></head></html>`, {
          status: 200,
        })
      )

    const result = await canonicalValidation.run(makeContext(html, url))

    expect(result.status).toBe('passed')
  })

  it('should fail when canonical URL returns 404', async () => {
    const html = '<html><head><link rel="canonical" href="https://example.com/gone"></head></html>'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }))

    const result = await canonicalValidation.run(makeContext(html, 'https://example.com/gone'))

    expect(result.status).toBe('failed')
    expect(result.details?.status).toBe(404)
  })

  it('should warn when canonical URL redirects', async () => {
    const html = '<html><head><link rel="canonical" href="https://example.com/old"></head></html>'

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 301 }))

    const result = await canonicalValidation.run(makeContext(html, 'https://example.com/old'))

    expect(result.status).toBe('warning')
    expect(result.details?.message).toContain('redirects')
  })

  it('should fail when canonical chain is detected', async () => {
    const pageUrl = 'https://example.com/page-a'
    const canonicalUrl = 'https://example.com/page-b'
    const chainedUrl = 'https://example.com/page-c'
    const html = `<html><head><link rel="canonical" href="${canonicalUrl}"></head></html>`

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(`<html><head><link rel="canonical" href="${chainedUrl}"></head></html>`, {
          status: 200,
        })
      )

    const result = await canonicalValidation.run(makeContext(html, pageUrl))

    expect(result.status).toBe('failed')
    expect(result.details?.message).toContain('chain detected')
    expect(result.details?.targetCanonical).toBe(chainedUrl)
  })

  it('should warn when canonical points to a different URL', async () => {
    const pageUrl = 'https://example.com/page-a'
    const canonicalUrl = 'https://example.com/page-b'
    const html = `<html><head><link rel="canonical" href="${canonicalUrl}"></head></html>`

    // Canonical page points to itself (no chain), but is different from current page
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(`<html><head><link rel="canonical" href="${canonicalUrl}"></head></html>`, {
          status: 200,
        })
      )

    const result = await canonicalValidation.run(makeContext(html, pageUrl))

    expect(result.status).toBe('warning')
    expect(result.details?.message).toContain('different URL')
  })

  it('should fail when canonical URL is unreachable', async () => {
    const html = '<html><head><link rel="canonical" href="https://example.com/page"></head></html>'

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const result = await canonicalValidation.run(makeContext(html, 'https://example.com/page'))

    expect(result.status).toBe('failed')
    expect(result.details?.message).toContain('Could not verify')
  })
})
