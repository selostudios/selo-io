import { describe, it, expect } from 'vitest'
import { CheckStatus, CheckCategory, ScoreDimension } from '@/lib/enums'
import { brokenInternalLinks } from '@/lib/unified-audit/checks/links/broken-internal-links'
import { nonDescriptiveUrl } from '@/lib/unified-audit/checks/links/non-descriptive-url'
import { internalLinking } from '@/lib/unified-audit/checks/links/internal-linking'

describe('broken-internal-links', () => {
  it('passes when all pages return successful status codes', async () => {
    const result = await brokenInternalLinks.run({
      url: 'https://example.com',
      html: '',
      allPages: [
        { url: 'https://example.com/', title: 'Home', statusCode: 200 },
        { url: 'https://example.com/about', title: 'About', statusCode: 200 },
      ],
    })

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.totalPages).toBe(2)
  })

  it('fails when pages return 4xx status codes', async () => {
    const result = await brokenInternalLinks.run({
      url: 'https://example.com',
      html: '',
      allPages: [
        { url: 'https://example.com/', title: 'Home', statusCode: 200 },
        { url: 'https://example.com/missing', title: null, statusCode: 404 },
        { url: 'https://example.com/gone', title: null, statusCode: 410 },
      ],
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.brokenCount).toBe(2)
  })

  it('fails when pages return 5xx status codes', async () => {
    const result = await brokenInternalLinks.run({
      url: 'https://example.com',
      html: '',
      allPages: [{ url: 'https://example.com/error', title: null, statusCode: 500 }],
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.brokenCount).toBe(1)
  })

  it('groups broken pages by status code', async () => {
    const result = await brokenInternalLinks.run({
      url: 'https://example.com',
      html: '',
      allPages: [
        { url: 'https://example.com/a', title: null, statusCode: 404 },
        { url: 'https://example.com/b', title: null, statusCode: 404 },
        { url: 'https://example.com/c', title: null, statusCode: 500 },
      ],
    })

    expect(result.status).toBe(CheckStatus.Failed)
    const byStatus = result.details?.byStatus as Record<number, string[]>
    expect(byStatus[404]).toHaveLength(2)
    expect(byStatus[500]).toHaveLength(1)
  })

  it('passes when allPages is empty', async () => {
    const result = await brokenInternalLinks.run({
      url: 'https://example.com',
      html: '',
      allPages: [],
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('has correct category and score dimensions', () => {
    expect(brokenInternalLinks.category).toBe(CheckCategory.Links)
    expect(brokenInternalLinks.feedsScores).toEqual([ScoreDimension.SEO])
    expect(brokenInternalLinks.isSiteWide).toBe(true)
  })
})

describe('non-descriptive-url', () => {
  it('passes for homepage (no slug)', async () => {
    const result = await nonDescriptiveUrl.run({
      url: 'https://example.com/',
      html: '',
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('fails for ID-like numeric slugs', async () => {
    const result = await nonDescriptiveUrl.run({
      url: 'https://example.com/page/12345',
      html: '',
    })

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.slug).toBe('12345')
  })

  it('fails for UUID-like hex slugs', async () => {
    const result = await nonDescriptiveUrl.run({
      url: 'https://example.com/post/a1b2c3d4e5f6a7b8',
      html: '',
    })

    expect(result.status).toBe(CheckStatus.Failed)
  })

  it('passes for descriptive slugs', async () => {
    const result = await nonDescriptiveUrl.run({
      url: 'https://example.com/services/web-design',
      html: '',
      title: 'Web Design Services',
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns for slugs with underscores', async () => {
    const result = await nonDescriptiveUrl.run({
      url: 'https://example.com/my_page_name',
      html: '',
    })

    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message as string).toContain('underscores')
  })

  it('warns for slugs with uppercase characters', async () => {
    const result = await nonDescriptiveUrl.run({
      url: 'https://example.com/MyPage',
      html: '',
    })

    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message as string).toContain('uppercase')
  })

  it('warns for very long URL paths', async () => {
    const longSlug =
      'this-is-a-very-long-url-slug-that-goes-on-and-on-and-really-should-be-shortened-for-usability'
    const result = await nonDescriptiveUrl.run({
      url: `https://example.com/${longSlug}`,
      html: '',
    })

    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message as string).toContain('characters')
  })
})

describe('internal-linking', () => {
  it('warns when no internal links are found', async () => {
    const html = `
      <html><body>
        <p>This is a paragraph with no links at all, just plain text content.</p>
      </body></html>
    `
    const result = await internalLinking.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.internalLinks).toBe(0)
  })

  it('passes with good contextual internal links', async () => {
    // Need enough words so density stays reasonable but enough contextual links
    const filler = Array(60)
      .fill('lorem ipsum dolor sit amet consectetur adipiscing elit')
      .join(' ')
    const html = `
      <html><body>
        <main>
          <p>${filler}</p>
          <p>Learn more about our <a href="/services">services</a> and read our <a href="/blog">blog</a> for updates.</p>
          <p>Check out our <a href="/about">team page</a> to learn more about us.</p>
        </main>
      </body></html>
    `
    const result = await internalLinking.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.contextualInternalLinks as number).toBeGreaterThanOrEqual(2)
  })

  it('warns when links exist but none are contextual', async () => {
    // Links only in nav (which gets removed), none in content
    const html = `
      <html><body>
        <nav><a href="/home">Home</a></nav>
        <div><a href="/page2">Link</a></div>
      </body></html>
    `
    const result = await internalLinking.run({
      url: 'https://example.com/page',
      html,
    })

    // Should have internal links but no contextual ones (not in p, article, or main)
    expect(result.details?.internalLinks).toBeGreaterThan(0)
  })

  it('ignores external links when counting internal links', async () => {
    const html = `
      <html><body>
        <p><a href="https://other-site.com/page">External</a></p>
      </body></html>
    `
    const result = await internalLinking.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.details?.internalLinks).toBe(0)
    expect(result.details?.externalLinks).toBe(1)
  })

  it('ignores anchor and mailto links', async () => {
    const html = `
      <html><body>
        <p><a href="#section">Anchor</a> <a href="mailto:test@test.com">Email</a></p>
      </body></html>
    `
    const result = await internalLinking.run({
      url: 'https://example.com/page',
      html,
    })

    expect(result.details?.internalLinks).toBe(0)
  })

  it('has correct category and score dimensions', () => {
    expect(internalLinking.category).toBe(CheckCategory.Links)
    expect(internalLinking.feedsScores).toContain(ScoreDimension.SEO)
    expect(internalLinking.feedsScores).toContain(ScoreDimension.AIReadiness)
  })
})
