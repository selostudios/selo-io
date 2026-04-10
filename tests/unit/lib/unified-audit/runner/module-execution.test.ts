import { describe, test, expect, vi } from 'vitest'
import { executeModules } from '@/lib/unified-audit/runner'
import { ScoreDimension, CheckStatus, CheckPriority } from '@/lib/enums'
import type { AuditModule, AuditCheck } from '@/lib/unified-audit/types'

function makeCheck(dimension: ScoreDimension): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'crawlability' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status: CheckStatus.Passed,
    display_name: 'Test',
    display_name_passed: 'Test',
    description: 'Test',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [dimension],
    created_at: new Date().toISOString(),
  }
}

function makeMockModule(dimension: ScoreDimension, score: number, shouldFail = false): AuditModule {
  return {
    dimension,
    checks: [],
    calculateScore: shouldFail
      ? () => {
          throw new Error(`${dimension} scoring failed`)
        }
      : () => score,
  }
}

describe('executeModules', () => {
  test('returns results for all modules', async () => {
    const modules = [
      makeMockModule(ScoreDimension.SEO, 85),
      makeMockModule(ScoreDimension.Performance, 70),
      makeMockModule(ScoreDimension.AIReadiness, 90),
    ]
    const results = await executeModules(modules, [])
    expect(results).toHaveLength(3)
    expect(results.find((r) => r.dimension === ScoreDimension.SEO)?.score).toBe(85)
    expect(results.find((r) => r.dimension === ScoreDimension.Performance)?.score).toBe(70)
    expect(results.find((r) => r.dimension === ScoreDimension.AIReadiness)?.score).toBe(90)
  })

  test('records timing for each module', async () => {
    const modules = [makeMockModule(ScoreDimension.SEO, 85)]
    const results = await executeModules(modules, [])
    expect(results[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  test('marks failed modules without blocking others', async () => {
    const modules = [
      makeMockModule(ScoreDimension.SEO, 85),
      makeMockModule(ScoreDimension.Performance, 70, true),
      makeMockModule(ScoreDimension.AIReadiness, 90),
    ]
    const results = await executeModules(modules, [])
    expect(results.find((r) => r.dimension === ScoreDimension.SEO)!.status).toBe('completed')
    expect(results.find((r) => r.dimension === ScoreDimension.Performance)!.status).toBe('failed')
    expect(results.find((r) => r.dimension === ScoreDimension.Performance)!.error).toBeDefined()
    expect(results.find((r) => r.dimension === ScoreDimension.AIReadiness)!.status).toBe(
      'completed'
    )
  })

  test('filters checks by dimension for scoring', async () => {
    const seoCheck = makeCheck(ScoreDimension.SEO)
    const perfCheck = makeCheck(ScoreDimension.Performance)
    const scoreFn = vi.fn().mockReturnValue(75)
    const modules: AuditModule[] = [
      {
        dimension: ScoreDimension.SEO,
        checks: [],
        calculateScore: scoreFn,
      },
    ]
    await executeModules(modules, [seoCheck, perfCheck])
    expect(scoreFn).toHaveBeenCalledWith(expect.arrayContaining([seoCheck]), undefined)
    expect(scoreFn).toHaveBeenCalledWith(expect.not.arrayContaining([perfCheck]), undefined)
  })
})
