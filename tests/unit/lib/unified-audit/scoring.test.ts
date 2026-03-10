import { describe, test, expect } from 'vitest'
import {
  calculateCheckScore,
  calculateSEOScore,
  calculatePerformanceScore,
  calculateAIReadinessScore,
  calculateOverallScore,
  getScoreStatus,
} from '@/lib/unified-audit/scoring'
import { CheckCategory, CheckPriority, CheckStatus, ScoreDimension, ScoreStatus } from '@/lib/enums'
import type { AuditCheck } from '@/lib/unified-audit/types'

const makeCheck = (overrides: Partial<AuditCheck> = {}): AuditCheck => ({
  id: 'test',
  audit_id: 'audit',
  page_url: null,
  category: CheckCategory.Crawlability,
  check_name: 'test',
  priority: CheckPriority.Critical,
  status: CheckStatus.Passed,
  display_name: 'Test',
  display_name_passed: 'Test passed',
  description: '',
  fix_guidance: null,
  learn_more_url: null,
  details: null,
  feeds_scores: [ScoreDimension.SEO],
  created_at: '',
  ...overrides,
})

describe('Unified Scoring', () => {
  describe('calculateCheckScore', () => {
    test('returns 0 for empty checks', () => {
      expect(calculateCheckScore([])).toBe(0)
    })

    test('returns 100 when all checks pass', () => {
      const checks = [
        makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Passed }),
        makeCheck({ priority: CheckPriority.Recommended, status: CheckStatus.Passed }),
        makeCheck({ priority: CheckPriority.Optional, status: CheckStatus.Passed }),
      ]
      expect(calculateCheckScore(checks)).toBe(100)
    })

    test('returns 0 when all checks fail', () => {
      const checks = [
        makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Failed }),
        makeCheck({ priority: CheckPriority.Recommended, status: CheckStatus.Failed }),
      ]
      expect(calculateCheckScore(checks)).toBe(0)
    })

    test('weights critical 3x, recommended 2x, optional 1x', () => {
      // Critical passed (3 * 100 = 300), Critical failed (3 * 0 = 0), Recommended warning (2 * 50 = 100)
      // Total weight = 3 + 3 + 2 = 8, Earned = 300 + 0 + 100 = 400
      // Score = 400 / 800 * 100 = 50
      const checks = [
        makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Passed }),
        makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Failed }),
        makeCheck({ priority: CheckPriority.Recommended, status: CheckStatus.Warning }),
      ]
      expect(calculateCheckScore(checks)).toBe(50)
    })

    test('warning counts as half credit', () => {
      const checks = [makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Warning })]
      expect(calculateCheckScore(checks)).toBe(50)
    })

    test('optional checks have less weight impact', () => {
      // 1 critical pass (3*100=300), 1 optional fail (1*0=0)
      // Total = 4, Earned = 300, Score = 300/400*100 = 75
      const checks = [
        makeCheck({ priority: CheckPriority.Critical, status: CheckStatus.Passed }),
        makeCheck({ priority: CheckPriority.Optional, status: CheckStatus.Failed }),
      ]
      expect(calculateCheckScore(checks)).toBe(75)
    })
  })

  describe('calculateSEOScore', () => {
    test('only uses checks that feed SEO', () => {
      const checks = [
        makeCheck({ feeds_scores: [ScoreDimension.SEO], status: CheckStatus.Passed }),
        makeCheck({ feeds_scores: [ScoreDimension.Performance], status: CheckStatus.Failed }),
      ]
      expect(calculateSEOScore(checks)).toBe(100)
    })

    test('includes checks that feed multiple scores including SEO', () => {
      const checks = [
        makeCheck({
          feeds_scores: [ScoreDimension.SEO, ScoreDimension.AIReadiness],
          status: CheckStatus.Failed,
        }),
      ]
      expect(calculateSEOScore(checks)).toBe(0)
    })
  })

  describe('calculatePerformanceScore', () => {
    test('only uses checks that feed Performance', () => {
      const checks = [
        makeCheck({ feeds_scores: [ScoreDimension.Performance], status: CheckStatus.Passed }),
        makeCheck({ feeds_scores: [ScoreDimension.SEO], status: CheckStatus.Failed }),
      ]
      expect(calculatePerformanceScore(checks)).toBe(100)
    })
  })

  describe('calculateAIReadinessScore', () => {
    test('blends 40% programmatic + 60% strategic when AI analysis available', () => {
      const checks = [
        makeCheck({ feeds_scores: [ScoreDimension.AIReadiness], status: CheckStatus.Passed }),
      ]
      // programmatic = 100, strategic = 80
      // 100 * 0.4 + 80 * 0.6 = 40 + 48 = 88
      expect(calculateAIReadinessScore(checks, 80)).toBe(88)
    })

    test('uses 100% programmatic when no AI analysis', () => {
      const checks = [
        makeCheck({ feeds_scores: [ScoreDimension.AIReadiness], status: CheckStatus.Passed }),
      ]
      expect(calculateAIReadinessScore(checks, null)).toBe(100)
    })

    test('handles low programmatic + high strategic', () => {
      const checks = [
        makeCheck({ feeds_scores: [ScoreDimension.AIReadiness], status: CheckStatus.Failed }),
      ]
      // programmatic = 0, strategic = 100
      // 0 * 0.4 + 100 * 0.6 = 60
      expect(calculateAIReadinessScore(checks, 100)).toBe(60)
    })
  })

  describe('calculateOverallScore', () => {
    test('applies correct weights: SEO 40%, Performance 30%, AI 30%', () => {
      // 80*0.4 + 70*0.3 + 90*0.3 = 32 + 21 + 27 = 80
      expect(calculateOverallScore(80, 70, 90)).toBe(80)
    })

    test('returns null when any score is null', () => {
      expect(calculateOverallScore(80, null, 90)).toBeNull()
      expect(calculateOverallScore(null, 70, 90)).toBeNull()
      expect(calculateOverallScore(80, 70, null)).toBeNull()
    })

    test('returns 100 when all scores are 100', () => {
      expect(calculateOverallScore(100, 100, 100)).toBe(100)
    })

    test('returns 0 when all scores are 0', () => {
      expect(calculateOverallScore(0, 0, 0)).toBe(0)
    })

    test('supports custom weights', () => {
      // Equal weights: (80 + 70 + 90) / 3 = 80
      const equalWeights = { seo: 1 / 3, performance: 1 / 3, ai_readiness: 1 / 3 }
      expect(calculateOverallScore(80, 70, 90, equalWeights)).toBe(80)
    })
  })

  describe('getScoreStatus', () => {
    test('returns Good for 80+', () => {
      expect(getScoreStatus(80)).toBe(ScoreStatus.Good)
      expect(getScoreStatus(100)).toBe(ScoreStatus.Good)
    })

    test('returns NeedsImprovement for 60-79', () => {
      expect(getScoreStatus(60)).toBe(ScoreStatus.NeedsImprovement)
      expect(getScoreStatus(79)).toBe(ScoreStatus.NeedsImprovement)
    })

    test('returns Poor for below 60', () => {
      expect(getScoreStatus(59)).toBe(ScoreStatus.Poor)
      expect(getScoreStatus(0)).toBe(ScoreStatus.Poor)
    })
  })
})
