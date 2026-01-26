import { describe, expect, it } from 'vitest'
import { contentDepth } from '@/lib/geo/checks/content-quality/content-depth'
import type { GEOCheckContext } from '@/lib/geo/types'

describe('contentDepth check', () => {
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

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe('failed')
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

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe('warning')
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

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe('passed')
    expect(result.details?.wordCount).toBeGreaterThanOrEqual(800)
    expect(result.details?.wordCount).toBeLessThan(1500)
    expect(result.details?.message).toContain('Good content depth')
  })

  it('should pass for excellent content (1500+ words)', async () => {
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

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    expect(result.status).toBe('passed')
    expect(result.details?.wordCount).toBeGreaterThanOrEqual(1500)
    expect(result.details?.message).toContain('Excellent content depth')
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

    const context: GEOCheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await contentDepth.run(context)

    // Should only count main content (very few words)
    expect(result.details?.wordCount).toBeLessThan(50)
  })
})
