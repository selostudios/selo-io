import { describe, expect, it } from 'vitest'
import { headingHierarchy } from '@/lib/unified-audit/checks/content-structure/heading-hierarchy'
import type { CheckContext } from '@/lib/unified-audit/types'

const makeContext = (html: string): CheckContext => ({
  url: 'https://example.com/',
  html,
  title: 'Test Page',
  statusCode: 200,
  allPages: [],
})

describe('headingHierarchy check', () => {
  it('should pass when headings follow correct order', async () => {
    const html = `
      <html><body>
        <h1>Title</h1>
        <h2>Section</h2>
        <h3>Subsection</h3>
        <h2>Another Section</h2>
      </body></html>
    `

    const result = await headingHierarchy.run(makeContext(html))

    expect(result.status).toBe('passed')
  })

  it('should warn when heading levels are skipped', async () => {
    const html = `
      <html><body>
        <h1>Title</h1>
        <h3>Jumped to H3</h3>
      </body></html>
    `

    const result = await headingHierarchy.run(makeContext(html))

    expect(result.status).toBe('warning')
    expect(result.details?.skippedLevels).toContain('H1 \u2192 H3')
  })

  it('should detect multiple skipped levels', async () => {
    const html = `
      <html><body>
        <h1>Title</h1>
        <h4>Jumped to H4</h4>
        <h2>Back to H2</h2>
        <h5>Jumped to H5</h5>
      </body></html>
    `

    const result = await headingHierarchy.run(makeContext(html))

    expect(result.status).toBe('warning')
    const skipped = result.details?.skippedLevels as string[]
    expect(skipped).toHaveLength(2)
    expect(skipped).toContain('H1 \u2192 H4')
    expect(skipped).toContain('H2 \u2192 H5')
  })

  it('should pass when no headings exist', async () => {
    const html = `
      <html><body>
        <p>Just a paragraph</p>
      </body></html>
    `

    const result = await headingHierarchy.run(makeContext(html))

    expect(result.status).toBe('passed')
  })

  it('should allow going from higher to lower without skip', async () => {
    const html = `
      <html><body>
        <h1>Title</h1>
        <h2>Section</h2>
        <h3>Sub</h3>
        <h2>Back to H2 (allowed)</h2>
      </body></html>
    `

    const result = await headingHierarchy.run(makeContext(html))

    expect(result.status).toBe('passed')
  })
})
