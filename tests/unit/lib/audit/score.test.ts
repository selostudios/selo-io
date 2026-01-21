import { describe, it, expect } from 'vitest'
import { calculateScores } from '@/lib/audit/runner'
import type { SiteAuditCheck, CheckType, CheckPriority, CheckStatus } from '@/lib/audit/types'

// Create mock check results for testing
function createCheckResult(
  type: CheckType,
  priority: CheckPriority,
  status: CheckStatus
): SiteAuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_id: 'test-page',
    check_type: type,
    check_name: `test_${type}_${priority}`,
    priority,
    status,
    details: null,
    created_at: new Date().toISOString(),
  }
}

describe('calculateScores', () => {
  it('returns 100 when all checks pass', () => {
    const results = [
      createCheckResult('seo', 'critical', 'passed'),
      createCheckResult('seo', 'recommended', 'passed'),
      createCheckResult('ai_readiness', 'critical', 'passed'),
      createCheckResult('technical', 'critical', 'passed'),
    ]
    const scores = calculateScores(results)
    expect(scores.overall_score).toBe(100)
    expect(scores.seo_score).toBe(100)
    expect(scores.ai_readiness_score).toBe(100)
    expect(scores.technical_score).toBe(100)
  })

  it('returns 0 when all checks fail', () => {
    const results = [
      createCheckResult('seo', 'critical', 'failed'),
      createCheckResult('seo', 'recommended', 'failed'),
    ]
    const scores = calculateScores(results)
    expect(scores.seo_score).toBe(0)
  })

  it('weights critical checks higher than recommended', () => {
    // All critical pass, all recommended fail
    const results1 = [
      createCheckResult('seo', 'critical', 'passed'),
      createCheckResult('seo', 'recommended', 'failed'),
    ]
    const score1 = calculateScores(results1).seo_score

    // All critical fail, all recommended pass
    const results2 = [
      createCheckResult('seo', 'critical', 'failed'),
      createCheckResult('seo', 'recommended', 'passed'),
    ]
    const score2 = calculateScores(results2).seo_score

    // Passing critical should result in higher score
    expect(score1).toBeGreaterThan(score2)
  })

  it('handles empty results', () => {
    const scores = calculateScores([])
    expect(scores.overall_score).toBe(100)
    expect(scores.seo_score).toBe(100)
    expect(scores.ai_readiness_score).toBe(100)
    expect(scores.technical_score).toBe(100)
  })

  it('gives warning status half credit', () => {
    const passedResults = [createCheckResult('seo', 'critical', 'passed')]
    const warningResults = [createCheckResult('seo', 'critical', 'warning')]
    const failedResults = [createCheckResult('seo', 'critical', 'failed')]

    const passedScore = calculateScores(passedResults).seo_score
    const warningScore = calculateScores(warningResults).seo_score
    const failedScore = calculateScores(failedResults).seo_score

    expect(passedScore).toBe(100)
    expect(warningScore).toBe(50)
    expect(failedScore).toBe(0)
  })

  it('calculates overall score as average of category scores', () => {
    // Create results where each category has different scores
    const results = [
      // SEO: all pass = 100
      createCheckResult('seo', 'critical', 'passed'),
      // AI: all fail = 0
      createCheckResult('ai_readiness', 'critical', 'failed'),
      // Technical: warning = 50
      createCheckResult('technical', 'critical', 'warning'),
    ]
    const scores = calculateScores(results)

    expect(scores.seo_score).toBe(100)
    expect(scores.ai_readiness_score).toBe(0)
    expect(scores.technical_score).toBe(50)
    // Overall should be (100 + 0 + 50) / 3 = 50
    expect(scores.overall_score).toBe(50)
  })

  it('correctly weights different priorities', () => {
    // Weights: critical=3, recommended=2, optional=1
    // Total weight = 3 + 2 + 1 = 6
    // If only critical passes: 3/6 = 50%
    const results = [
      createCheckResult('seo', 'critical', 'passed'),
      createCheckResult('seo', 'recommended', 'failed'),
      createCheckResult('seo', 'optional', 'failed'),
    ]
    const scores = calculateScores(results)
    expect(scores.seo_score).toBe(50) // 3/6 = 50%
  })

  it('rounds scores to whole numbers', () => {
    // Create a scenario that would produce a decimal
    // critical=3 passed, recommended=2 failed, optional=1 passed
    // Total = 6, earned = 4, score = 4/6 = 66.67 -> 67
    const results = [
      createCheckResult('seo', 'critical', 'passed'),
      createCheckResult('seo', 'recommended', 'failed'),
      createCheckResult('seo', 'optional', 'passed'),
    ]
    const scores = calculateScores(results)
    expect(scores.seo_score).toBe(67) // 4/6 rounded = 67
    expect(Number.isInteger(scores.seo_score)).toBe(true)
  })

  it('handles mixed check types correctly', () => {
    const results = [
      createCheckResult('seo', 'critical', 'passed'),
      createCheckResult('seo', 'critical', 'failed'),
      createCheckResult('ai_readiness', 'critical', 'passed'),
      createCheckResult('technical', 'critical', 'passed'),
      createCheckResult('technical', 'critical', 'passed'),
    ]
    const scores = calculateScores(results)

    // SEO: 1 pass, 1 fail = 50%
    expect(scores.seo_score).toBe(50)
    // AI: 1 pass = 100%
    expect(scores.ai_readiness_score).toBe(100)
    // Technical: 2 pass = 100%
    expect(scores.technical_score).toBe(100)
    // Overall: (50 + 100 + 100) / 3 = 83.33 -> 83
    expect(scores.overall_score).toBe(83)
  })
})
