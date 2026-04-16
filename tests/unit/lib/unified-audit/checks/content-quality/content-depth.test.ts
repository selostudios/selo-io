import { describe, expect, it } from 'vitest'
import { contentDepth } from '@/lib/unified-audit/checks/content-quality/content-depth'
import type { CheckContext } from '@/lib/unified-audit/types'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'

describe('contentDepth check', () => {
  it('should have correct metadata', () => {
    expect(contentDepth.name).toBe('content_depth')
    expect(contentDepth.category).toBe(CheckCategory.ContentQuality)
    expect(contentDepth.priority).toBe(CheckPriority.Recommended)
    expect(contentDepth.isSiteWide).toBe(false)
    expect(contentDepth.feedsScores).toEqual([ScoreDimension.SEO])
  })

  it('should fail for very thin content (< 300 words)', async () => {
    const html = `
      <html>
        <body>
          <main>
            <h1>Short Article</h1>
            <p>This is a very short article with minimal content. It has less than three hundred words.</p>
            <p>AI engines prefer comprehensive content with depth and detail.</p>
          </main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.wordCount).toBeLessThan(300)
    expect(result.details?.message).toContain('Very thin content')
  })

  it('should warn for moderate content (300-800 words)', async () => {
    // Generate ~500 word content
    const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
    const html = `
      <html>
        <body>
          <main>
            <h1>Moderate Article</h1>
            ${paragraph.repeat(5)}
          </main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.wordCount).toBeGreaterThanOrEqual(300)
    expect(result.details?.wordCount).toBeLessThan(800)
    expect(result.details?.message).toContain('Moderate content depth')
  })

  it('should pass for good content (800-1500 words)', async () => {
    // Generate ~1000 word content
    const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
    const html = `
      <html>
        <body>
          <main>
            <h1>Good Article</h1>
            ${paragraph.repeat(12)}
          </main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.wordCount).toBeGreaterThanOrEqual(800)
    expect(result.details?.wordCount).toBeLessThan(1500)
  })

  it('should pass with excellent message for 1500+ words', async () => {
    // Generate ~2000 word content
    const paragraph = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10)
    const html = `
      <html>
        <body>
          <article>
            <h1>Comprehensive Article</h1>
            ${paragraph.repeat(25)}
          </article>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.wordCount).toBeGreaterThanOrEqual(1500)
  })

  it('should exclude nav, header, footer from word count', async () => {
    const html = `
      <html>
        <body>
          <nav>
            ${'Navigation link text. '.repeat(50)}
          </nav>
          <header>
            ${'Header content here. '.repeat(50)}
          </header>
          <main>
            <h1>Main Content</h1>
            <p>This is the actual content.</p>
          </main>
          <footer>
            ${'Footer text here. '.repeat(50)}
          </footer>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    // Should only count main content (very few words)
    expect(result.details?.wordCount).toBeLessThan(50)
  })

  it('should include fixGuidance in failed result', async () => {
    const html = `
      <html>
        <body>
          <main><p>Short.</p></main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.fixGuidance).toBeDefined()
  })
})
