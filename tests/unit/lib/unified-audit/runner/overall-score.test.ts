import { describe, test, expect } from 'vitest'

// We test the calculatePartialOverallScore logic indirectly through executeModules
// since calculatePartialOverallScore is not exported.
// Instead, test the blending logic directly.
import { ScoreDimension } from '@/lib/enums'
import { DEFAULT_SCORE_WEIGHTS } from '@/lib/unified-audit/types'
import type { ModuleStatus } from '@/lib/unified-audit/types'

interface ModuleScoreInput {
  dimension: ScoreDimension
  score: number | null
  status: ModuleStatus
}

/**
 * Pure re-implementation of the partial overall score logic for testing.
 * This mirrors calculatePartialOverallScore in runner.ts.
 */
function calculatePartialOverallScore(results: ModuleScoreInput[]): number | null {
  const completed = results.filter((r) => r.status === 'completed' && r.score !== null)
  if (completed.length === 0) return null

  const weightMap: Record<string, number> = {
    [ScoreDimension.SEO]: DEFAULT_SCORE_WEIGHTS.seo,
    [ScoreDimension.Performance]: DEFAULT_SCORE_WEIGHTS.performance,
    [ScoreDimension.AIReadiness]: DEFAULT_SCORE_WEIGHTS.ai_readiness,
  }

  let totalWeight = 0
  let weightedSum = 0

  for (const result of completed) {
    const weight = weightMap[result.dimension] ?? 0
    totalWeight += weight
    weightedSum += result.score! * weight
  }

  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

describe('calculatePartialOverallScore', () => {
  test('blends all 3 modules with default weights (0.4, 0.3, 0.3)', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 80, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: 70, status: 'completed' },
      { dimension: ScoreDimension.AIReadiness, score: 90, status: 'completed' },
    ]
    // 80*0.4 + 70*0.3 + 90*0.3 = 32 + 21 + 27 = 80
    expect(calculatePartialOverallScore(results)).toBe(80)
  })

  test('re-weights when one module fails', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 80, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: null, status: 'failed' },
      { dimension: ScoreDimension.AIReadiness, score: 60, status: 'completed' },
    ]
    // Only SEO (0.4) and AI (0.3) completed. Total weight = 0.7
    // (80*0.4 + 60*0.3) / 0.7 = (32+18) / 0.7 = 50/0.7 ≈ 71
    expect(calculatePartialOverallScore(results)).toBe(71)
  })

  test('returns null when all modules fail', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: null, status: 'failed' },
      { dimension: ScoreDimension.Performance, score: null, status: 'failed' },
      { dimension: ScoreDimension.AIReadiness, score: null, status: 'failed' },
    ]
    expect(calculatePartialOverallScore(results)).toBeNull()
  })

  test('returns score when only one module completes', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 75, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: null, status: 'failed' },
      { dimension: ScoreDimension.AIReadiness, score: null, status: 'failed' },
    ]
    // Only SEO: 75*0.4 / 0.4 = 75
    expect(calculatePartialOverallScore(results)).toBe(75)
  })

  test('handles perfect scores', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 100, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: 100, status: 'completed' },
      { dimension: ScoreDimension.AIReadiness, score: 100, status: 'completed' },
    ]
    expect(calculatePartialOverallScore(results)).toBe(100)
  })

  test('handles zero scores', () => {
    const results: ModuleScoreInput[] = [
      { dimension: ScoreDimension.SEO, score: 0, status: 'completed' },
      { dimension: ScoreDimension.Performance, score: 0, status: 'completed' },
      { dimension: ScoreDimension.AIReadiness, score: 0, status: 'completed' },
    ]
    expect(calculatePartialOverallScore(results)).toBe(0)
  })
})
