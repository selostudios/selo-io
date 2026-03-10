import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckStatus } from '@/lib/enums'
import type { CheckContext } from '@/lib/unified-audit/types'
import type { AICrawlerBreakdown, LlmsTxtValidation } from '@/lib/unified-audit/types'
import { aiCrawlerAccess } from '@/lib/unified-audit/checks/crawlability/ai-crawler-access'
import { llmsTxt, validateLlmsTxt } from '@/lib/unified-audit/checks/crawlability/llms-txt'
import { jsRendering } from '@/lib/unified-audit/checks/crawlability/js-rendering'
import { noindexDetection } from '@/lib/unified-audit/checks/crawlability/noindex-detection'
import { robotsTxtValidation } from '@/lib/unified-audit/checks/crawlability/robots-txt-validation'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

// =============================================================================
// AI Crawler Access — Enhanced per-bot breakdown
// =============================================================================

describe('ai-crawler-access', () => {
  it('should fail when GPTBot is blocked in robots.txt', async () => {
    const robotsTxt = `User-agent: GPTBot
Disallow: /

User-agent: *
Allow: /`

    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt,
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    const breakdown = result.details?.breakdown as AICrawlerBreakdown
    expect(breakdown.criticalBlocked).toContain('GPTBot')
    expect(breakdown.blockedCount).toBeGreaterThanOrEqual(1)

    // GPTBot should be marked as blocked
    const gptBot = breakdown.bots.find((b) => b.name === 'GPTBot')
    expect(gptBot?.status).toBe('blocked')
  })

  it('should fail when all critical bots are blocked', async () => {
    const robotsTxt = `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: *
Allow: /`

    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt,
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    const breakdown = result.details?.breakdown as AICrawlerBreakdown
    expect(breakdown.criticalBlocked).toEqual(
      expect.arrayContaining(['GPTBot', 'ClaudeBot', 'PerplexityBot'])
    )
  })

  it('should pass when all bots are allowed (no robots.txt rules)', async () => {
    const robotsTxt = `User-agent: *
Allow: /`

    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt,
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe(CheckStatus.Passed)
    const breakdown = result.details?.breakdown as AICrawlerBreakdown
    expect(breakdown.blockedCount).toBe(0)
    expect(breakdown.criticalBlocked).toHaveLength(0)
  })

  it('should warn when only non-critical bots are blocked', async () => {
    const robotsTxt = `User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: *
Allow: /`

    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt,
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe(CheckStatus.Warning)
    const breakdown = result.details?.breakdown as AICrawlerBreakdown
    expect(breakdown.criticalBlocked).toHaveLength(0)
    expect(breakdown.blockedCount).toBeGreaterThanOrEqual(2)
  })

  it('should detect wildcard block affecting all bots', async () => {
    const robotsTxt = `User-agent: *
Disallow: /`

    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt,
    }

    const result = await aiCrawlerAccess.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    const breakdown = result.details?.breakdown as AICrawlerBreakdown
    // All bots should be blocked via wildcard
    expect(breakdown.blockedCount).toBe(14)
    expect(breakdown.criticalBlocked).toContain('GPTBot')
  })

  it('should handle specific allow override for a bot with wildcard block', async () => {
    // GPTBot has specific rules that don't block root, while wildcard blocks all
    const robotsTxt = `User-agent: GPTBot
Allow: /

User-agent: *
Disallow: /`

    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt,
    }

    const result = await aiCrawlerAccess.run(context)

    // GPTBot should be allowed (specific rule), others blocked by wildcard
    const breakdown = result.details?.breakdown as AICrawlerBreakdown
    const gptBot = breakdown.bots.find((b) => b.name === 'GPTBot')
    expect(gptBot?.status).toBe('allowed')
    // Other critical bots should be blocked
    expect(breakdown.criticalBlocked).toContain('ClaudeBot')
  })

  it('should return 14 bots in breakdown', async () => {
    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt: 'User-agent: *\nAllow: /',
    }

    const result = await aiCrawlerAccess.run(context)
    const breakdown = result.details?.breakdown as AICrawlerBreakdown
    expect(breakdown.bots).toHaveLength(14)
  })
})

// =============================================================================
// llms.txt — 4-tier validation
// =============================================================================

describe('llms-txt', () => {
  describe('validateLlmsTxt', () => {
    it('should return "malformed" for HTML content', () => {
      const result = validateLlmsTxt(
        '<!DOCTYPE html><html><body>Not a valid llms.txt</body></html>',
        'https://example.com/llms.txt',
        200
      )
      expect(result.tier).toBe('malformed')
      expect(result.exists).toBe(true)
    })

    it('should return "malformed" for JSON content', () => {
      const result = validateLlmsTxt('{"error": "not found"}', 'https://example.com/llms.txt', 200)
      expect(result.tier).toBe('malformed')
    })

    it('should return "malformed" for empty content', () => {
      const result = validateLlmsTxt('', 'https://example.com/llms.txt', 200)
      expect(result.tier).toBe('malformed')
    })

    it('should return "minimal" for file with title but no URLs', () => {
      const result = validateLlmsTxt(
        '# My Company\nWe do great things for the world.',
        'https://example.com/llms.txt',
        200
      )
      expect(result.tier).toBe('minimal')
      expect(result.sections.hasTitle).toBe(true)
      expect(result.sections.hasDescription).toBe(true)
      expect(result.sections.hasPageList).toBe(false)
    })

    it('should return "minimal" for file with URLs but no title', () => {
      const result = validateLlmsTxt(
        'Some description text here for the page.\nhttps://example.com/about',
        'https://example.com/llms.txt',
        200
      )
      expect(result.tier).toBe('minimal')
      expect(result.sections.hasTitle).toBe(false)
      expect(result.sections.hasPageList).toBe(true)
    })

    it('should return "valid" for properly structured llms.txt', () => {
      const content = `# Example Company

> Example Company provides marketing analytics tools for growing businesses.

## About
- [About Us](https://example.com/about)
- [Our Team](https://example.com/team)

## Products
- [Analytics Dashboard](https://example.com/products/analytics)
- [SEO Tools](https://example.com/products/seo)`

      const result = validateLlmsTxt(content, 'https://example.com/llms.txt', 200)
      expect(result.tier).toBe('valid')
      expect(result.sections.hasTitle).toBe(true)
      expect(result.sections.hasDescription).toBe(true)
      expect(result.sections.hasPageList).toBe(true)
      expect(result.sections.sectionCount).toBe(2)
    })

    it('should detect sitemap references', () => {
      const content = `# My Site

Description of the site for LLMs.

## Sitemap
- [Sitemap](https://example.com/sitemap.xml)`

      const result = validateLlmsTxt(content, 'https://example.com/llms.txt', 200)
      expect(result.sections.hasSitemapRef).toBe(true)
    })
  })

  describe('llms-txt check run', () => {
    it('should fail when llms.txt returns 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      })

      const context: CheckContext = {
        url: 'https://example.com/',
        html: '<html></html>',
      }

      const result = await llmsTxt.run(context)
      expect(result.status).toBe(CheckStatus.Failed)
      const validation = result.details?.validation as LlmsTxtValidation
      expect(validation.tier).toBe('missing')
    })

    it('should pass when llms.txt is valid', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => `# My Company

> We build amazing AI tools for marketers worldwide.

## Pages
- [Home](https://example.com/)
- [About](https://example.com/about)`,
      })

      const context: CheckContext = {
        url: 'https://example.com/',
        html: '<html></html>',
      }

      const result = await llmsTxt.run(context)
      expect(result.status).toBe(CheckStatus.Passed)
      const validation = result.details?.validation as LlmsTxtValidation
      expect(validation.tier).toBe('valid')
    })

    it('should warn when llms.txt is minimal', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '# My Company\nWe do things.',
      })

      const context: CheckContext = {
        url: 'https://example.com/',
        html: '<html></html>',
      }

      const result = await llmsTxt.run(context)
      expect(result.status).toBe(CheckStatus.Warning)
      const validation = result.details?.validation as LlmsTxtValidation
      expect(validation.tier).toBe('minimal')
    })
  })
})

// =============================================================================
// JS Rendering — SSR content detection
// =============================================================================

describe('js-rendering', () => {
  it('should pass for pages with sufficient server-rendered content', async () => {
    const html = `<html><body>
      <h1>Welcome to Our Site</h1>
      <p>${'Lorem ipsum dolor sit amet. '.repeat(20)}</p>
      <p>Another paragraph with meaningful content about our products and services.</p>
    </body></html>`

    const context: CheckContext = { url: 'https://example.com/', html }
    const result = await jsRendering.run(context)

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.wordCount).toBeGreaterThanOrEqual(100)
  })

  it('should fail for SPA with minimal content and React detected', async () => {
    const html = `<html><body>
      <div id="root"></div>
      <script src="/bundle.js"></script>
    </body></html>`

    const context: CheckContext = { url: 'https://example.com/', html }
    const result = await jsRendering.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.isSPA).toBe(true)
    expect(result.details?.detectedFrameworks).toContain('React')
  })

  it('should fail for pages with heavy JS and low content', async () => {
    const scripts = Array.from({ length: 15 }, (_, i) => `<script src="/chunk${i}.js"></script>`)
    const html = `<html><body>
      <div>Loading...</div>
      ${scripts.join('\n')}
    </body></html>`

    const context: CheckContext = { url: 'https://example.com/', html }
    const result = await jsRendering.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.scriptCount).toBeGreaterThanOrEqual(15)
  })

  it('should detect Vue framework', async () => {
    const html = `<html><body>
      <div v-app>
        <p>Some content here but not much really.</p>
      </div>
    </body></html>`

    const context: CheckContext = { url: 'https://example.com/', html }
    const result = await jsRendering.run(context)

    // Low content with Vue detected
    expect(result.details?.detectedFrameworks).toContain('Vue')
  })

  it('should detect Angular framework', async () => {
    const html = `<html><body>
      <app-root ng-version="16.0.0">
        <p>Small amount of content.</p>
      </app-root>
    </body></html>`

    const context: CheckContext = { url: 'https://example.com/', html }
    const result = await jsRendering.run(context)

    expect(result.details?.detectedFrameworks).toContain('Angular')
  })

  it('should identify SSR content with __NEXT_DATA__', async () => {
    const html = `<html><body>
      <div id="__next">
        <h1>Server Rendered Page</h1>
        <p>${'This is server-rendered content from Next.js with plenty of text. '.repeat(10)}</p>
      </div>
      <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
    </body></html>`

    const context: CheckContext = { url: 'https://example.com/', html }
    const result = await jsRendering.run(context)

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.message).toContain('Server-rendered')
  })
})

// =============================================================================
// Noindex Detection
// =============================================================================

describe('noindex-detection', () => {
  it('should fail when homepage has noindex', async () => {
    const html = `<html><head><meta name="robots" content="noindex, nofollow"></head><body></body></html>`
    const context: CheckContext = { url: 'https://example.com/', html }

    const result = await noindexDetection.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.metaContent).toContain('noindex')
  })

  it('should warn when deep page has noindex', async () => {
    const html = `<html><head><meta name="robots" content="noindex"></head><body></body></html>`
    const context: CheckContext = { url: 'https://example.com/blog/post/some-article', html }

    const result = await noindexDetection.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('should pass when no noindex is present', async () => {
    const html = `<html><head><meta name="robots" content="index, follow"></head><body></body></html>`
    const context: CheckContext = { url: 'https://example.com/', html }

    const result = await noindexDetection.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('should detect googlebot-specific noindex', async () => {
    const html = `<html><head><meta name="googlebot" content="noindex"></head><body></body></html>`
    const context: CheckContext = { url: 'https://example.com/', html }

    const result = await noindexDetection.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
  })
})

// =============================================================================
// robots.txt Validation
// =============================================================================

describe('robots-txt-validation', () => {
  it('should pass for well-formed robots.txt with context.robotsTxt', async () => {
    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt: `User-agent: *
Disallow: /admin/
Sitemap: https://example.com/sitemap.xml`,
    }

    const result = await robotsTxtValidation.run(context)
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.hasSitemap).toBe(true)
    expect(result.details?.hasCrawlRules).toBe(true)
  })

  it('should warn for empty robots.txt', async () => {
    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      robotsTxt: 'This is just some random text without directives',
    }

    const result = await robotsTxtValidation.run(context)
    expect(result.status).toBe(CheckStatus.Warning)
  })

  it('should fail when fetch returns 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })

    const context: CheckContext = {
      url: 'https://example.com/',
      html: '<html></html>',
      // no robotsTxt in context — will fetch
    }

    const result = await robotsTxtValidation.run(context)
    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.statusCode).toBe(404)
  })
})
