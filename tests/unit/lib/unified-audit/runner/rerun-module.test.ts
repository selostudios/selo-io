import { describe, test, expect, vi } from 'vitest'
import { ScoreDimension, CheckStatus, CheckPriority } from '@/lib/enums'
import type { AuditCheck, AuditModule } from '@/lib/unified-audit/types'
import { executeModules } from '@/lib/unified-audit/runner'

function makeCheck(
  dimension: ScoreDimension,
  status: CheckStatus = CheckStatus.Passed
): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'crawlability' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status,
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

describe('rerun single module via executeModules', () => {
  test('can execute a single module independently', async () => {
    const scoreFn = vi.fn().mockReturnValue(85)
    const singleModule: AuditModule[] = [
      {
        dimension: ScoreDimension.AIReadiness,
        checks: [],
        calculateScore: scoreFn,
      },
    ]

    const checks = [
      makeCheck(ScoreDimension.AIReadiness, CheckStatus.Passed),
      makeCheck(ScoreDimension.SEO, CheckStatus.Failed), // should be filtered out
    ]

    const results = await executeModules(singleModule, checks)

    expect(results).toHaveLength(1)
    expect(results[0].dimension).toBe(ScoreDimension.AIReadiness)
    expect(results[0].score).toBe(85)

    // Verify only AI Readiness checks were passed to scoring
    const passedChecks = scoreFn.mock.calls[0][0] as AuditCheck[]
    expect(passedChecks).toHaveLength(1)
    expect(passedChecks[0].feeds_scores).toContain(ScoreDimension.AIReadiness)
  })

  test('post-crawl phase failure falls back to programmatic scoring', async () => {
    const singleModule: AuditModule[] = [
      {
        dimension: ScoreDimension.AIReadiness,
        checks: [],
        runPostCrawlPhase: async () => {
          throw new Error('Claude API down')
        },
        calculateScore: (checks, phaseResult) => {
          // Should receive undefined phaseResult on failure
          return phaseResult ? 50 : 100
        },
      },
    ]

    const postCrawlContext = {
      auditId: 'test-audit',
      url: 'https://example.com',
      allPages: [],
      sampleSize: 5,
      organizationId: null,
    }

    const results = await executeModules(singleModule, [], postCrawlContext)

    expect(results[0].status).toBe('completed')
    expect(results[0].score).toBe(100) // 100% programmatic fallback
  })
})
