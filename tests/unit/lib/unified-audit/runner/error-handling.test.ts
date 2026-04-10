import { describe, test, expect } from 'vitest'
import { executeModules } from '@/lib/unified-audit/runner'
import { ScoreDimension } from '@/lib/enums'
import type { AuditModule, PostCrawlContext } from '@/lib/unified-audit/types'

const mockPostCrawlContext: PostCrawlContext = {
  auditId: 'test',
  url: 'https://example.com',
  allPages: [],
  sampleSize: 5,
  organizationId: null,
}

function makeModule(
  dimension: ScoreDimension,
  opts: { score?: number; phaseThrows?: boolean; scoreThrows?: boolean } = {}
): AuditModule {
  return {
    dimension,
    checks: [],
    runPostCrawlPhase: opts.phaseThrows
      ? async () => {
          throw new Error(`${dimension} phase error`)
        }
      : undefined,
    calculateScore: opts.scoreThrows
      ? () => {
          throw new Error(`${dimension} scoring error`)
        }
      : () => opts.score ?? 80,
  }
}

describe('module error handling', () => {
  test('post-crawl phase failure does not mark module as failed', async () => {
    const modules = [makeModule(ScoreDimension.AIReadiness, { phaseThrows: true, score: 75 })]
    const results = await executeModules(modules, [], mockPostCrawlContext)

    // Module should still complete with programmatic-only score
    expect(results[0].status).toBe('completed')
    expect(results[0].score).toBe(75)
  })

  test('scoring failure marks module as failed', async () => {
    const modules = [makeModule(ScoreDimension.SEO, { scoreThrows: true })]
    const results = await executeModules(modules, [])

    expect(results[0].status).toBe('failed')
    expect(results[0].score).toBeNull()
    expect(results[0].error).toBeDefined()
    expect(results[0].error!.phase).toBe('scoring')
  })

  test('one module failure does not affect others', async () => {
    const modules = [
      makeModule(ScoreDimension.SEO, { score: 80 }),
      makeModule(ScoreDimension.Performance, { scoreThrows: true }),
      makeModule(ScoreDimension.AIReadiness, { score: 90 }),
    ]

    const results = await executeModules(modules, [])

    expect(results.find((r) => r.dimension === ScoreDimension.SEO)!.status).toBe('completed')
    expect(results.find((r) => r.dimension === ScoreDimension.Performance)!.status).toBe('failed')
    expect(results.find((r) => r.dimension === ScoreDimension.AIReadiness)!.status).toBe(
      'completed'
    )
  })

  test('error includes timestamp and phase', async () => {
    const modules = [makeModule(ScoreDimension.SEO, { scoreThrows: true })]
    const results = await executeModules(modules, [])

    expect(results[0].error!.timestamp).toBeDefined()
    expect(results[0].error!.phase).toBe('scoring')
    expect(results[0].error!.message).toContain('scoring error')
  })

  test('all modules failing returns all failed results', async () => {
    const modules = [
      makeModule(ScoreDimension.SEO, { scoreThrows: true }),
      makeModule(ScoreDimension.Performance, { scoreThrows: true }),
      makeModule(ScoreDimension.AIReadiness, { scoreThrows: true }),
    ]

    const results = await executeModules(modules, [])

    expect(results.every((r) => r.status === 'failed')).toBe(true)
    expect(results.every((r) => r.score === null)).toBe(true)
  })
})
