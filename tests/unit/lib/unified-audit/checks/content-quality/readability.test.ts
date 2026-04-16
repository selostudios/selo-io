import { describe, expect, it } from 'vitest'
import { readability } from '@/lib/unified-audit/checks/content-quality/readability'
import type { CheckContext } from '@/lib/unified-audit/types'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension } from '@/lib/enums'

describe('readability check', () => {
  it('should have correct metadata', () => {
    expect(readability.name).toBe('readability')
    expect(readability.category).toBe(CheckCategory.ContentQuality)
    expect(readability.priority).toBe(CheckPriority.Recommended)
    expect(readability.isSiteWide).toBe(false)
    expect(readability.feedsScores).toEqual([ScoreDimension.SEO])
  })

  it('should pass for simple, readable content', async () => {
    // Simple sentences with short words produce high Flesch scores
    const html = `
      <html>
        <body>
          <main>
            <h1>Simple Guide</h1>
            <p>The cat sat on the mat. The dog ran in the park. The sun was bright and warm. Kids played in the yard. Birds sang in the trees. The day was nice and calm.</p>
            <p>We like to read short books. They are fun and easy. You can read one each day. It is a good way to learn. Try it and see how it goes.</p>
            <p>The sky is blue and wide. The grass is green and soft. The wind is cool and light. Life is good and kind. We are glad to be here now.</p>
          </main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await readability.run(context)

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.fleschScore).toBeGreaterThanOrEqual(60)
  })

  it('should fail for empty content', async () => {
    const html = `
      <html>
        <body>
          <main></main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await readability.run(context)

    expect(result.status).toBe(CheckStatus.Failed)
    expect(result.details?.message).toContain('No readable content')
  })

  it('should calculate Flesch score correctly for known text', async () => {
    // "The cat sat on the mat." - 6 words, 1 sentence, simple syllables
    // Words: The(1), cat(1), sat(1), on(1), the(1), mat(1) = 6 syllables
    // Flesch = 206.835 - 1.015*(6/1) - 84.6*(6/6) = 206.835 - 6.09 - 84.6 = 116.145
    const html = `
      <html>
        <body>
          <main>
            <p>The cat sat on the mat.</p>
          </main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await readability.run(context)

    expect(result.status).toBe(CheckStatus.Passed)
    // Flesch score should be very high for this simple sentence
    expect(result.details?.fleschScore).toBeGreaterThan(100)
    expect(result.details?.totalWords).toBe(6)
    expect(result.details?.totalSentences).toBe(1)
    expect(result.details?.avgSentenceLength).toBe(6)
  })

  it('should warn or fail for complex academic content', async () => {
    // Long sentences with polysyllabic words produce low Flesch scores
    const html = `
      <html>
        <body>
          <main>
            <p>The epistemological implications of deconstructionist phenomenological methodologies fundamentally undermine the hermeneutical interpretative frameworks traditionally employed within contemporary philosophical investigations of consciousness, notwithstanding the considerable institutional resistance encountered from established interdisciplinary academic communities investigating these extraordinarily sophisticated paradigmatic considerations.</p>
            <p>Furthermore, the ontological presuppositions inherent within poststructuralist theoretical conceptualizations necessarily problematize the epistemically privileged perspectival determinations characteristically associated with the predominant methodological instrumentalization of phenomenological transcendentalist philosophical investigations.</p>
          </main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await readability.run(context)

    // Complex academic text should score poorly
    expect([CheckStatus.Warning, CheckStatus.Failed]).toContain(result.status)
    expect(result.details?.fleschScore).toBeLessThan(60)
  })

  it('should exclude nav, header, footer, aside from analysis', async () => {
    const html = `
      <html>
        <body>
          <nav>Extraordinarily sophisticated phenomenological methodological considerations.</nav>
          <header>Epistemological hermeneutical interdisciplinary philosophical investigations.</header>
          <main>
            <p>The cat sat on the mat. The dog ran fast. It was fun.</p>
          </main>
          <aside>Deconstructionist poststructuralist conceptualizations and instrumentalization.</aside>
          <footer>Ontological presuppositions characteristically problematize determinations.</footer>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await readability.run(context)

    // Should only analyze main content (simple text), so should pass
    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.fleschScore).toBeGreaterThanOrEqual(60)
  })

  it('should include avgSentenceLength and avgWordLength in details', async () => {
    const html = `
      <html>
        <body>
          <main>
            <p>This is a test. It has short words. The text is clear.</p>
          </main>
        </body>
      </html>
    `

    const context: CheckContext = {
      url: 'https://example.com/',
      html,
    }

    const result = await readability.run(context)

    expect(result.details?.avgSentenceLength).toBeDefined()
    expect(result.details?.avgWordLength).toBeDefined()
    expect(result.details?.fleschScore).toBeDefined()
  })
})
