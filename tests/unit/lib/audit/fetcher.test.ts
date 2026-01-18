// tests/unit/lib/audit/fetcher.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPage, extractLinks } from '@/lib/audit/fetcher'

describe('fetchPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should fetch page and return html with status code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html><head><title>Test</title></head><body></body></html>'),
    })

    const result = await fetchPage('https://example.com')

    expect(result.html).toContain('<title>Test</title>')
    expect(result.statusCode).toBe(200)
  })

  it('should handle fetch errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await fetchPage('https://example.com')

    expect(result.html).toBe('')
    expect(result.statusCode).toBe(0)
    expect(result.error).toBe('Network error')
  })
})

describe('extractLinks', () => {
  it('should extract internal links from HTML', () => {
    const html = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="https://external.com">External</a>
          <a href="https://example.com/products">Products</a>
        </body>
      </html>
    `
    const baseUrl = 'https://example.com'

    const links = extractLinks(html, baseUrl)

    expect(links).toContain('https://example.com/about')
    expect(links).toContain('https://example.com/contact')
    expect(links).toContain('https://example.com/products')
    expect(links).not.toContain('https://external.com')
  })

  it('should deduplicate links', () => {
    const html = `
      <html>
        <body>
          <a href="/about">About</a>
          <a href="/about">About Again</a>
        </body>
      </html>
    `
    const links = extractLinks(html, 'https://example.com')

    expect(links.filter((l) => l === 'https://example.com/about')).toHaveLength(1)
  })
})
