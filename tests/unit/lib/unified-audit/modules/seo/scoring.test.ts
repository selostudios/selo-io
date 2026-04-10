import { describe, test, expect } from 'vitest'
import { calculateSEOModuleScore } from '@/lib/unified-audit/modules/seo/scoring'
import { CheckPriority, CheckStatus } from '@/lib/enums'
import type { AuditCheck } from '@/lib/unified-audit/types'

function makeCheck(overrides: Partial<AuditCheck> = {}): AuditCheck {
  return {
    id: crypto.randomUUID(),
    audit_id: 'test-audit',
    page_url: 'https://example.com',
    category: 'crawlability' as AuditCheck['category'],
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

describe('calculateSEOModuleScore', () => {
  test('returns 0 for empty checks', () => {
    expect(calculateSEOModuleScore([])).toBe(0)
  })

  test('returns 100 for all passed checks', () => {
    const checks = [
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Recommended }),
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Optional }),
    ]
    expect(calculateSEOModuleScore(checks)).toBe(100)
  })

  test('returns 0 for all failed checks', () => {
    const checks = [
      makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Recommended }),
    ]
    expect(calculateSEOModuleScore(checks)).toBe(0)
  })

  test('weights critical checks 3x, recommended 2x, optional 1x', () => {
    const checks = [
      makeCheck({ status: CheckStatus.Passed, priority: CheckPriority.Critical }),
      makeCheck({ status: CheckStatus.Failed, priority: CheckPriority.Recommended }),
    ]
    // Critical passed: 3 * 100 = 300, Recommended failed: 2 * 0 = 0
    // Total weight: 3 + 2 = 5, Earned: 300 / (500) = 0.6 => 60
    expect(calculateSEOModuleScore(checks)).toBe(60)
  })

  test('scores warnings at 50 points', () => {
    const checks = [makeCheck({ status: CheckStatus.Warning, priority: CheckPriority.Recommended })]
    // Recommended warning: 2 * 50 = 100, Total weight: 2
    // 100 / (200) = 0.5 => 50
    expect(calculateSEOModuleScore(checks)).toBe(50)
  })
})
