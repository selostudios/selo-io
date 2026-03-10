import { describe, expect, it } from 'vitest'
import { citationFormat } from '@/lib/unified-audit/checks/content-structure/citation-format'
import type { CheckContext } from '@/lib/unified-audit/types'

const makeContext = (html: string): CheckContext => ({
  url: 'https://example.com/',
  html,
  title: 'Test Page',
  statusCode: 200,
  allPages: [],
})

describe('citationFormat check', () => {
  it('should warn when no citations or external links are found', async () => {
    const html = `
      <html><body>
        <h1>My Article</h1>
        <p>Some content without any links.</p>
      </body></html>
    `

    const result = await citationFormat.run(makeContext(html))

    expect(result.status).toBe('warning')
    expect(result.details?.message).toContain('No citations or source links')
  })

  it('should pass with 3+ authoritative source links', async () => {
    const html = `
      <html><body>
        <p>Research from <a href="https://harvard.edu/study">Harvard</a></p>
        <p>Data from <a href="https://cdc.gov/data">CDC</a></p>
        <p>See also <a href="https://mozilla.org/docs">Mozilla</a></p>
      </body></html>
    `

    const result = await citationFormat.run(makeContext(html))

    expect(result.status).toBe('passed')
    expect(result.details?.message).toContain('Strong citation format')
  })

  it('should pass with a reference section heading', async () => {
    const html = `
      <html><body>
        <h1>Article</h1>
        <p>Content here</p>
        <h2>References</h2>
        <p><a href="https://other-site.com/page">Source 1</a></p>
      </body></html>
    `

    const result = await citationFormat.run(makeContext(html))

    expect(result.status).toBe('passed')
    expect(result.details?.indicators).toContain('reference section')
  })

  it('should warn with few authoritative links and no reference section', async () => {
    const html = `
      <html><body>
        <p>See <a href="https://stanford.edu/paper">this paper</a></p>
        <p>Also <a href="https://random-blog.com">this blog</a></p>
      </body></html>
    `

    const result = await citationFormat.run(makeContext(html))

    expect(result.status).toBe('warning')
    expect(result.details?.message).toContain('could be improved')
  })
})
