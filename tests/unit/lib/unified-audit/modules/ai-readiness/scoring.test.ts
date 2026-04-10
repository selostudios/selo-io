import { describe, test, expect } from 'vitest'
import { calculateAIReadinessModuleScore } from '@/lib/unified-audit/modules/ai-readiness/scoring'
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck, PostCrawlResult } from '@/lib/unified-audit/types'

function makeCheck(overrides: Partial<AuditCheck> = {}): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'ai_visibility' as AuditCheck['category'],
    check_name: 'test_check',
    priority: CheckPriority.Recommended,
    status: CheckStatus.Passed,
    display_name: 'Test Check',
    display_name_passed: 'Test Check',
    description: 'A test check',
    fix_guidance: null,
    learn_more_url: null,
    details: null,
    feeds_scores: [],
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('calculateAIReadinessModuleScore', () => {
  test('returns 0 for empty checks and no AI result', () => {
    expect(calculateAIReadinessModuleScore([])).toBe(0)
  })

  test('returns 100% programmatic when no post-crawl result', () => {
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    expect(calculateAIReadinessModuleScore(checks)).toBe(100)
  })

  test('returns 100% programmatic when strategicScore is null', () => {
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: null }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(100)
  })

  test('blends 50/50 when strategicScore is provided', () => {
    // Programmatic: 1 critical passed = 100
    // Strategic: 80
    // Blended: 100 * 0.5 + 80 * 0.5 = 90
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 80 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(90)
  })

  test('blends with 0 programmatic score', () => {
    const checks = [makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 60 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(30)
  })

  test('blends with 0 strategic score', () => {
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 0 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(50)
  })

  test('both scores at 100', () => {
    const checks = [makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 100 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(100)
  })

  test('both scores at 0', () => {
    const checks = [makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Critical })]
    const phaseResult: PostCrawlResult = { strategicScore: 0 }
    expect(calculateAIReadinessModuleScore(checks, phaseResult)).toBe(0)
  })
})
