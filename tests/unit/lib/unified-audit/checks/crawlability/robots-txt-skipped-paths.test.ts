import { describe, it, expect } from 'vitest'
import { robotsTxtSkippedPaths } from '@/lib/unified-audit/checks/crawlability/robots-txt-skipped-paths'
import { CheckStatus } from '@/lib/enums'
import type { CheckContext } from '@/lib/unified-audit/types'

const baseContext: CheckContext = {
  url: 'https://example.com',
  html: '<html><body></body></html>',
}

describe('robotsTxtSkippedPaths', () => {
  it('passes when no robots.txt rules exist', async () => {
    const result = await robotsTxtSkippedPaths.run(baseContext)

    expect(result.status).toBe(CheckStatus.Passed)
    expect(result.details?.skippedPaths).toEqual([])
  })

  it('passes when rules have no disallow entries', async () => {
    const result = await robotsTxtSkippedPaths.run({
      ...baseContext,
      robotsTxtRules: { rules: [], crawlDelayMs: null },
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })

  it('warns when disallowed paths exist', async () => {
    const result = await robotsTxtSkippedPaths.run({
      ...baseContext,
      robotsTxtRules: {
        rules: [
          { type: 'disallow', path: '/admin' },
          { type: 'disallow', path: '/private' },
          { type: 'allow', path: '/api/public' },
        ],
        crawlDelayMs: null,
      },
    })

    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.skippedPaths).toEqual(['/admin', '/private'])
    expect(result.details?.message).toContain('2 paths')
    expect(result.details?.message).toContain('/admin')
    expect(result.details?.message).toContain('/private')
  })

  it('reports single path correctly', async () => {
    const result = await robotsTxtSkippedPaths.run({
      ...baseContext,
      robotsTxtRules: {
        rules: [{ type: 'disallow', path: '/secret' }],
        crawlDelayMs: null,
      },
    })

    expect(result.status).toBe(CheckStatus.Warning)
    expect(result.details?.message).toContain('1 path blocked')
  })

  it('passes when only allow rules exist', async () => {
    const result = await robotsTxtSkippedPaths.run({
      ...baseContext,
      robotsTxtRules: {
        rules: [{ type: 'allow', path: '/public' }],
        crawlDelayMs: null,
      },
    })

    expect(result.status).toBe(CheckStatus.Passed)
  })
})
