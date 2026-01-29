import { describe, it, expect } from 'vitest'
import {
  calculateCombinedScore,
  getScoreBreakdown,
  getScoreWithStatus,
  hasImprovementPotential,
  calculatePotentialImprovement,
  formatScore,
  formatScorePercent,
  getScoreColorClass,
  getScoreBackgroundClass,
  getScoreBadgeVariant,
  getScoreStatusLabel,
  getScoreGrade,
  getScoreContributions,
} from '@/lib/reports/score-calculator'
import { ScoreStatus } from '@/lib/enums'

// ============================================================
// COMBINED SCORE CALCULATION TESTS
// ============================================================

describe('calculateCombinedScore', () => {
  it('calculates weighted average with default weights', () => {
    // SEO: 80 * 0.5 = 40
    // PageSpeed: 90 * 0.3 = 27
    // AIO: 70 * 0.2 = 14
    // Total: 81
    const score = calculateCombinedScore(80, 90, 70)
    expect(score).toBe(81)
  })

  it('returns null if any score is null', () => {
    expect(calculateCombinedScore(null, 90, 70)).toBeNull()
    expect(calculateCombinedScore(80, null, 70)).toBeNull()
    expect(calculateCombinedScore(80, 90, null)).toBeNull()
  })

  it('returns null for invalid scores', () => {
    expect(calculateCombinedScore(-10, 90, 70)).toBeNull()
    expect(calculateCombinedScore(80, 110, 70)).toBeNull()
  })

  it('returns 100 when all scores are 100', () => {
    expect(calculateCombinedScore(100, 100, 100)).toBe(100)
  })

  it('returns 0 when all scores are 0', () => {
    expect(calculateCombinedScore(0, 0, 0)).toBe(0)
  })

  it('uses custom weights when provided', () => {
    const customWeights = { seo: 0.33, page_speed: 0.34, aio: 0.33 }
    // 100 * 0.33 + 50 * 0.34 + 0 * 0.33 = 33 + 17 = 50
    const score = calculateCombinedScore(100, 50, 0, customWeights)
    expect(score).toBe(50)
  })

  it('rounds to nearest integer', () => {
    // 85 * 0.5 + 90 * 0.3 + 72 * 0.2 = 42.5 + 27 + 14.4 = 83.9 -> 84
    const score = calculateCombinedScore(85, 90, 72)
    expect(score).toBe(84)
    expect(Number.isInteger(score)).toBe(true)
  })
})

// ============================================================
// SCORE BREAKDOWN TESTS
// ============================================================

describe('getScoreBreakdown', () => {
  it('returns full breakdown with all scores', () => {
    const breakdown = getScoreBreakdown(80, 90, 70)

    expect(breakdown.seo_score).toBe(80)
    expect(breakdown.seo_weight).toBe(0.5)
    expect(breakdown.page_speed_score).toBe(90)
    expect(breakdown.page_speed_weight).toBe(0.3)
    expect(breakdown.aio_score).toBe(70)
    expect(breakdown.aio_weight).toBe(0.2)
    expect(breakdown.combined_score).toBe(81)
  })

  it('returns 0 for combined when any score is null', () => {
    const breakdown = getScoreBreakdown(80, null, 70)
    expect(breakdown.combined_score).toBe(0)
  })
})

// ============================================================
// SCORE STATUS TESTS
// ============================================================

describe('getScoreWithStatus', () => {
  it('returns Good status for scores >= 80', () => {
    expect(getScoreWithStatus(80).status).toBe(ScoreStatus.Good)
    expect(getScoreWithStatus(100).status).toBe(ScoreStatus.Good)
    expect(getScoreWithStatus(85).status).toBe(ScoreStatus.Good)
  })

  it('returns NeedsImprovement for scores 60-79', () => {
    expect(getScoreWithStatus(60).status).toBe(ScoreStatus.NeedsImprovement)
    expect(getScoreWithStatus(79).status).toBe(ScoreStatus.NeedsImprovement)
    expect(getScoreWithStatus(70).status).toBe(ScoreStatus.NeedsImprovement)
  })

  it('returns Poor status for scores < 60', () => {
    expect(getScoreWithStatus(59).status).toBe(ScoreStatus.Poor)
    expect(getScoreWithStatus(0).status).toBe(ScoreStatus.Poor)
    expect(getScoreWithStatus(30).status).toBe(ScoreStatus.Poor)
  })

  it('returns Poor status for null scores', () => {
    expect(getScoreWithStatus(null).status).toBe(ScoreStatus.Poor)
    expect(getScoreWithStatus(null).score).toBe(0)
  })
})

// ============================================================
// IMPROVEMENT POTENTIAL TESTS
// ============================================================

describe('hasImprovementPotential', () => {
  it('returns true for scores below threshold', () => {
    expect(hasImprovementPotential(80)).toBe(true)
    expect(hasImprovementPotential(84)).toBe(true)
  })

  it('returns false for scores at or above threshold', () => {
    expect(hasImprovementPotential(85)).toBe(false)
    expect(hasImprovementPotential(90)).toBe(false)
    expect(hasImprovementPotential(100)).toBe(false)
  })

  it('returns true for null scores', () => {
    expect(hasImprovementPotential(null)).toBe(true)
  })

  it('respects custom threshold', () => {
    expect(hasImprovementPotential(75, 70)).toBe(false)
    expect(hasImprovementPotential(65, 70)).toBe(true)
  })
})

describe('calculatePotentialImprovement', () => {
  it('calculates improvement for SEO category', () => {
    const result = calculatePotentialImprovement({ seo: 70, pageSpeed: 80, aio: 75 }, 'seo', 90)

    // Current: 70*0.5 + 80*0.3 + 75*0.2 = 35 + 24 + 15 = 74
    // Target:  90*0.5 + 80*0.3 + 75*0.2 = 45 + 24 + 15 = 84
    expect(result.currentCombined).toBe(74)
    expect(result.targetCombined).toBe(84)
    expect(result.improvement).toBe(10)
  })

  it('returns null improvement when scores are null', () => {
    const result = calculatePotentialImprovement({ seo: null, pageSpeed: 80, aio: 75 }, 'seo', 90)

    expect(result.currentCombined).toBeNull()
    expect(result.improvement).toBeNull()
  })
})

// ============================================================
// FORMATTING TESTS
// ============================================================

describe('formatScore', () => {
  it('returns score as string', () => {
    expect(formatScore(85)).toBe('85')
    expect(formatScore(100)).toBe('100')
    expect(formatScore(0)).toBe('0')
  })

  it('returns dash for null', () => {
    expect(formatScore(null)).toBe('-')
  })
})

describe('formatScorePercent', () => {
  it('returns score with percent sign', () => {
    expect(formatScorePercent(85)).toBe('85%')
    expect(formatScorePercent(100)).toBe('100%')
  })

  it('returns dash for null', () => {
    expect(formatScorePercent(null)).toBe('-')
  })
})

// ============================================================
// COLOR AND STYLING TESTS
// ============================================================

describe('getScoreColorClass', () => {
  it('returns green classes for Good status', () => {
    const classes = getScoreColorClass(ScoreStatus.Good)
    expect(classes).toContain('green')
  })

  it('returns yellow classes for NeedsImprovement status', () => {
    const classes = getScoreColorClass(ScoreStatus.NeedsImprovement)
    expect(classes).toContain('yellow')
  })

  it('returns red classes for Poor status', () => {
    const classes = getScoreColorClass(ScoreStatus.Poor)
    expect(classes).toContain('red')
  })
})

describe('getScoreBackgroundClass', () => {
  it('returns appropriate background classes', () => {
    expect(getScoreBackgroundClass(ScoreStatus.Good)).toContain('green')
    expect(getScoreBackgroundClass(ScoreStatus.NeedsImprovement)).toContain('yellow')
    expect(getScoreBackgroundClass(ScoreStatus.Poor)).toContain('red')
  })
})

describe('getScoreBadgeVariant', () => {
  it('returns correct badge variants', () => {
    expect(getScoreBadgeVariant(ScoreStatus.Good)).toBe('default')
    expect(getScoreBadgeVariant(ScoreStatus.NeedsImprovement)).toBe('secondary')
    expect(getScoreBadgeVariant(ScoreStatus.Poor)).toBe('destructive')
  })
})

describe('getScoreStatusLabel', () => {
  it('returns human-readable labels', () => {
    expect(getScoreStatusLabel(ScoreStatus.Good)).toBe('Good')
    expect(getScoreStatusLabel(ScoreStatus.NeedsImprovement)).toBe('Needs Improvement')
    expect(getScoreStatusLabel(ScoreStatus.Poor)).toBe('Poor')
  })
})

// ============================================================
// GRADE CALCULATION TESTS
// ============================================================

describe('getScoreGrade', () => {
  it('returns A for 90+', () => {
    expect(getScoreGrade(90)).toBe('A')
    expect(getScoreGrade(100)).toBe('A')
    expect(getScoreGrade(95)).toBe('A')
  })

  it('returns B for 80-89', () => {
    expect(getScoreGrade(80)).toBe('B')
    expect(getScoreGrade(89)).toBe('B')
  })

  it('returns C for 70-79', () => {
    expect(getScoreGrade(70)).toBe('C')
    expect(getScoreGrade(79)).toBe('C')
  })

  it('returns D for 60-69', () => {
    expect(getScoreGrade(60)).toBe('D')
    expect(getScoreGrade(69)).toBe('D')
  })

  it('returns F for below 60', () => {
    expect(getScoreGrade(59)).toBe('F')
    expect(getScoreGrade(0)).toBe('F')
    expect(getScoreGrade(30)).toBe('F')
  })

  it('returns dash for null', () => {
    expect(getScoreGrade(null)).toBe('-')
  })
})

// ============================================================
// CONTRIBUTION CALCULATION TESTS
// ============================================================

describe('getScoreContributions', () => {
  it('calculates contributions for each category', () => {
    const contributions = getScoreContributions(80, 90, 70)

    // SEO: 80 * 0.5 = 40 points
    // PageSpeed: 90 * 0.3 = 27 points
    // AIO: 70 * 0.2 = 14 points
    // Combined: 81
    expect(contributions.seo.points).toBe(40)
    expect(contributions.pageSpeed.points).toBe(27)
    expect(contributions.aio.points).toBe(14)

    // Percentages should roughly add up to 100
    const totalPercent =
      contributions.seo.percent + contributions.pageSpeed.percent + contributions.aio.percent
    expect(totalPercent).toBeGreaterThanOrEqual(98)
    expect(totalPercent).toBeLessThanOrEqual(102) // Allow for rounding
  })

  it('returns zeros for null scores', () => {
    const contributions = getScoreContributions(null, 90, 70)

    expect(contributions.seo.points).toBe(0)
    expect(contributions.seo.percent).toBe(0)
    expect(contributions.pageSpeed.points).toBe(0)
    expect(contributions.aio.points).toBe(0)
  })

  it('handles zero combined score', () => {
    const contributions = getScoreContributions(0, 0, 0)

    expect(contributions.seo.percent).toBe(0)
    expect(contributions.pageSpeed.percent).toBe(0)
    expect(contributions.aio.percent).toBe(0)
  })
})
