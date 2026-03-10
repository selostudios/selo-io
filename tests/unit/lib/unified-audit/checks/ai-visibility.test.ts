import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckStatus } from '@/lib/enums'
import { contentAccessibility } from '@/lib/unified-audit/checks/ai-visibility/content-accessibility'
import { htmlStructure } from '@/lib/unified-audit/checks/ai-visibility/html-structure'
import { markdownAvailability } from '@/lib/unified-audit/checks/ai-visibility/markdown-availability'
import { citability } from '@/lib/unified-audit/checks/ai-visibility/citability'
import { brandMentions } from '@/lib/unified-audit/checks/ai-visibility/brand-mentions'
import { platformReadiness } from '@/lib/unified-audit/checks/ai-visibility/platform-readiness'
import type { CheckContext } from '@/lib/unified-audit/types'

function makeContext(html: string, overrides?: Partial<CheckContext>): CheckContext {
  return {
    url: 'https://example.com',
    html,
    ...overrides,
  }
}

// =============================================================================
// Content Accessibility
// =============================================================================

describe('content-accessibility', () => {
  it('passes when page has good semantic HTML and accessibility', async () => {
    const html = `
      <html lang="en">
        <head><title>Test</title></head>
        <body>
          <header><nav><a href="#">Home</a></nav></header>
          <main>
            <h1>Welcome</h1>
            <img src="logo.png" alt="Company logo" />
          </main>
          <footer>Footer</footer>
        </body>
      </html>
    `
    const result = await contentAccessibility.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns when some accessibility issues exist', async () => {
    const html = `
      <html lang="en">
        <head><title>Test</title></head>
        <body>
          <main>
            <h1>Welcome</h1>
            <h1>Second H1</h1>
            <img src="photo.png" alt="A photo" />
          </main>
        </body>
      </html>
    `
    const result = await contentAccessibility.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('fails when multiple accessibility problems are present', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <div>
            <img src="a.png" />
            <img src="b.png" />
          </div>
        </body>
      </html>
    `
    const result = await contentAccessibility.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
    const details = result.details as Record<string, unknown>
    expect((details.issues as string[]).length).toBeGreaterThan(2)
  })
})

// =============================================================================
// HTML Structure
// =============================================================================

describe('html-structure', () => {
  it('passes when semantic HTML5 elements are used', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <header><nav>Nav</nav></header>
          <main>
            <article>
              <h1>Title</h1>
              <section><h2>Section</h2><p>Content</p></section>
            </article>
          </main>
          <footer>Footer</footer>
        </body>
      </html>
    `
    const result = await htmlStructure.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    expect((result.details as Record<string, unknown>).semanticElements).toBeDefined()
  })

  it('warns when no semantic elements but headings exist', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <div><h1>Title</h1><p>Content</p></div>
        </body>
      </html>
    `
    const result = await htmlStructure.run(makeContext(html))
    // Only 1 issue (no semantic elements), so warning
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('fails when markup is all divs with no headings or semantic elements', async () => {
    // Create HTML that triggers 3+ issues: no semantic elements, no headings, high div ratio
    const divs = '<div>text</div>'.repeat(20)
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>${divs}</body>
      </html>
    `
    const result = await htmlStructure.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
  })
})

// =============================================================================
// Markdown Availability
// =============================================================================

describe('markdown-availability', () => {
  it('passes when llms.txt links are present', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <a href="/llms.txt">LLMs text file</a>
        </body>
      </html>
    `
    const result = await markdownAvailability.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('passes when .md file links are present', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <a href="/docs/guide.md">Guide</a>
        </body>
      </html>
    `
    const result = await markdownAvailability.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('fails when no markdown references exist', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </body>
      </html>
    `
    const result = await markdownAvailability.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
  })
})

// =============================================================================
// Citability
// =============================================================================

describe('citability', () => {
  it('passes when content has multiple citable passages', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <article>
            <p>Content marketing is a strategic approach focused on creating and distributing valuable, relevant, and consistent content to attract and retain a clearly defined audience. According to research by the Content Marketing Institute, 73% of B2B marketers use content marketing as part of their overall strategy.</p>
            <p>Search engine optimization refers to the process of improving the quality and quantity of website traffic from search engines. Data shows that 68% of online experiences begin with a search engine query, making SEO a critical component of digital strategy.</p>
            <p>Brand awareness describes the extent to which consumers recognize and recall a brand. According to a study by Nielsen, brands with high awareness see 23% more revenue compared to lesser-known competitors in the same category.</p>
            <p>Digital transformation is the integration of digital technology into all areas of a business. Research from McKinsey found that companies embracing digital transformation are 26% more profitable than their industry peers.</p>
          </article>
        </body>
      </html>
    `
    const result = await citability.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    const details = result.details as Record<string, unknown>
    expect(details.citablePassages).toBeGreaterThanOrEqual(3)
  })

  it('warns when only 1-2 citable passages exist', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <main>
            <p>Content marketing is a strategic approach focused on creating valuable content. According to research, 73% of marketers use it as part of their overall strategy to reach audiences effectively.</p>
            <p>We think this is great and it helps a lot. They say that these things matter and those results speak for themselves in this context.</p>
            <p>Another short thought about something.</p>
          </main>
        </body>
      </html>
    `
    const result = await citability.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('fails when no passages are citable', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <main>
            <p>Click here to learn more about it.</p>
            <p>They said this was great.</p>
            <p>Check it out now!</p>
          </main>
        </body>
      </html>
    `
    const result = await citability.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
    const details = result.details as Record<string, unknown>
    expect(details.citablePassages).toBe(0)
  })

  it('analyzes passage signals correctly', async () => {
    const html = `
      <html>
        <head><title>Test</title></head>
        <body>
          <article>
            <p>Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. According to a study by Gartner, 37% of organizations have implemented AI in some form, representing a 270% increase over the past four years.</p>
          </article>
        </body>
      </html>
    `
    const result = await citability.run(makeContext(html))
    const details = result.details as Record<string, unknown>
    const analysis = details.passageAnalysis as { signals: Record<string, boolean> }[]
    expect(analysis.length).toBeGreaterThan(0)
    // This passage should have definition pattern, statistics, and factual claims
    expect(analysis[0].signals.hasDefinitionPattern).toBe(true)
    expect(analysis[0].signals.hasStatistics).toBe(true)
    expect(analysis[0].signals.hasFactualClaims).toBe(true)
  })
})

// =============================================================================
// Brand Mentions
// =============================================================================

describe('brand-mentions', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('passes when Wikipedia article is found', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('wikipedia.org')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: {
                pages: {
                  '12345': {
                    pageid: 12345,
                    title: 'Acme Corp',
                    extract: 'Acme Corp is a technology company...',
                  },
                },
              },
            }),
        })
      }
      if (url.includes('wikidata.org')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              search: [{ id: 'Q123', description: 'technology company' }],
            }),
        })
      }
      return originalFetch(url)
    })

    const html = `
      <html>
        <head><title>Acme Corp - Homepage</title></head>
        <body><h1>Welcome to Acme Corp</h1></body>
      </html>
    `
    const result = await brandMentions.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    const details = result.details as Record<string, unknown>
    expect(details.brandName).toBe('Acme Corp')
  })

  it('warns when only Wikidata is found', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('wikipedia.org')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: {
                pages: {
                  '-1': { missing: '' },
                },
              },
            }),
        })
      }
      if (url.includes('wikidata.org')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              search: [{ id: 'Q456', description: 'a startup' }],
            }),
        })
      }
      return originalFetch(url)
    })

    const html = `
      <html>
        <head><title>TestBrand | Home</title></head>
        <body><h1>TestBrand</h1></body>
      </html>
    `
    const result = await brandMentions.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('fails when neither Wikipedia nor Wikidata have results', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('wikipedia.org')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: {
                pages: {
                  '-1': { missing: '' },
                },
              },
            }),
        })
      }
      if (url.includes('wikidata.org')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ search: [] }),
        })
      }
      return originalFetch(url)
    })

    const html = `
      <html>
        <head><title>Unknown Startup</title></head>
        <body><h1>Welcome</h1></body>
      </html>
    `
    const result = await brandMentions.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
    const details = result.details as Record<string, unknown>
    expect((details.gaps as string[]).length).toBeGreaterThan(0)
  })

  it('extracts brand name from JSON-LD schema', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('wikipedia.org')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: {
                pages: {
                  '999': {
                    pageid: 999,
                    title: 'Schema Brand',
                    extract: 'Schema Brand is...',
                  },
                },
              },
            }),
        })
      }
      if (url.includes('wikidata.org')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ search: [] }),
        })
      }
      return originalFetch(url)
    })

    const html = `
      <html>
        <head>
          <title>Some Other Title</title>
          <script type="application/ld+json">{"@type":"Organization","name":"Schema Brand"}</script>
        </head>
        <body><h1>Welcome</h1></body>
      </html>
    `
    const result = await brandMentions.run(makeContext(html))
    const details = result.details as Record<string, unknown>
    expect(details.brandName).toBe('Schema Brand')
  })

  it('handles API failures gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const html = `
      <html>
        <head><title>Test</title></head>
        <body><h1>Welcome</h1></body>
      </html>
    `
    const result = await brandMentions.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Failed)
  })
})

// =============================================================================
// Platform Readiness
// =============================================================================

describe('platform-readiness', () => {
  it('always returns passed with AI analysis flag', async () => {
    const html = '<html><head><title>Test</title></head><body></body></html>'
    const result = await platformReadiness.run(makeContext(html))
    expect(result.status).toBe(CheckStatus.Passed)
    const details = result.details as Record<string, unknown>
    expect(details.requiresAIAnalysis).toBe(true)
    expect(details.message).toContain('AI analysis phase')
  })
})
