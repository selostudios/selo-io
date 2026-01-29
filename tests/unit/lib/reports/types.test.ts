import { describe, it, expect } from 'vitest'
import {
  getScoreStatus,
  isScoreGood,
  getExpirationDays,
  getExpirationLabel,
  getShareErrorMessage,
  DEFAULT_SCORE_WEIGHTS,
} from '@/lib/reports/types'
import { ShareExpiration, ShareErrorCode, ScoreStatus } from '@/lib/enums'

// ============================================================
// SCORE STATUS UTILITY TESTS
// ============================================================

describe('getScoreStatus', () => {
  it('returns Good for scores >= 80', () => {
    expect(getScoreStatus(80)).toBe(ScoreStatus.Good)
    expect(getScoreStatus(90)).toBe(ScoreStatus.Good)
    expect(getScoreStatus(100)).toBe(ScoreStatus.Good)
  })

  it('returns NeedsImprovement for scores 60-79', () => {
    expect(getScoreStatus(60)).toBe(ScoreStatus.NeedsImprovement)
    expect(getScoreStatus(70)).toBe(ScoreStatus.NeedsImprovement)
    expect(getScoreStatus(79)).toBe(ScoreStatus.NeedsImprovement)
  })

  it('returns Poor for scores < 60', () => {
    expect(getScoreStatus(0)).toBe(ScoreStatus.Poor)
    expect(getScoreStatus(30)).toBe(ScoreStatus.Poor)
    expect(getScoreStatus(59)).toBe(ScoreStatus.Poor)
  })

  it('returns Poor for null', () => {
    expect(getScoreStatus(null)).toBe(ScoreStatus.Poor)
  })
})

describe('isScoreGood', () => {
  it('returns true for scores >= default threshold (85)', () => {
    expect(isScoreGood(85)).toBe(true)
    expect(isScoreGood(90)).toBe(true)
    expect(isScoreGood(100)).toBe(true)
  })

  it('returns false for scores < default threshold', () => {
    expect(isScoreGood(84)).toBe(false)
    expect(isScoreGood(80)).toBe(false)
    expect(isScoreGood(0)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isScoreGood(null)).toBe(false)
  })

  it('respects custom threshold', () => {
    expect(isScoreGood(75, 70)).toBe(true)
    expect(isScoreGood(65, 70)).toBe(false)
    expect(isScoreGood(90, 95)).toBe(false)
  })
})

// ============================================================
// EXPIRATION UTILITY TESTS
// ============================================================

describe('getExpirationDays', () => {
  it('returns 7 for SevenDays', () => {
    expect(getExpirationDays(ShareExpiration.SevenDays)).toBe(7)
  })

  it('returns 30 for ThirtyDays', () => {
    expect(getExpirationDays(ShareExpiration.ThirtyDays)).toBe(30)
  })

  it('returns 90 for NinetyDays', () => {
    expect(getExpirationDays(ShareExpiration.NinetyDays)).toBe(90)
  })

  it('returns 30 as default for Custom', () => {
    expect(getExpirationDays(ShareExpiration.Custom)).toBe(30)
  })
})

describe('getExpirationLabel', () => {
  it('returns readable labels', () => {
    expect(getExpirationLabel(ShareExpiration.SevenDays)).toBe('7 days')
    expect(getExpirationLabel(ShareExpiration.ThirtyDays)).toBe('30 days')
    expect(getExpirationLabel(ShareExpiration.NinetyDays)).toBe('90 days')
    expect(getExpirationLabel(ShareExpiration.Custom)).toBe('Custom')
  })
})

// ============================================================
// SHARE ERROR MESSAGE TESTS
// ============================================================

describe('getShareErrorMessage', () => {
  it('returns appropriate message for NotFound', () => {
    const msg = getShareErrorMessage(ShareErrorCode.NotFound)
    expect(msg).toContain('not exist')
  })

  it('returns appropriate message for Expired', () => {
    const msg = getShareErrorMessage(ShareErrorCode.Expired)
    expect(msg).toContain('expired')
  })

  it('returns appropriate message for ViewLimitExceeded', () => {
    const msg = getShareErrorMessage(ShareErrorCode.ViewLimitExceeded)
    expect(msg).toContain('view limit')
  })

  it('returns appropriate message for PasswordRequired', () => {
    const msg = getShareErrorMessage(ShareErrorCode.PasswordRequired)
    expect(msg).toContain('password')
  })

  it('returns appropriate message for InvalidPassword', () => {
    const msg = getShareErrorMessage(ShareErrorCode.InvalidPassword)
    expect(msg).toContain('password')
  })

  it('returns appropriate message for ReportNotFound', () => {
    const msg = getShareErrorMessage(ShareErrorCode.ReportNotFound)
    expect(msg).toContain('could not be found')
  })
})

// ============================================================
// DEFAULT WEIGHTS TESTS
// ============================================================

describe('DEFAULT_SCORE_WEIGHTS', () => {
  it('weights sum to 1.0', () => {
    const total =
      DEFAULT_SCORE_WEIGHTS.seo + DEFAULT_SCORE_WEIGHTS.page_speed + DEFAULT_SCORE_WEIGHTS.aio
    expect(total).toBe(1.0)
  })

  it('SEO has highest weight (0.5)', () => {
    expect(DEFAULT_SCORE_WEIGHTS.seo).toBe(0.5)
  })

  it('PageSpeed has second highest weight (0.3)', () => {
    expect(DEFAULT_SCORE_WEIGHTS.page_speed).toBe(0.3)
  })

  it('AIO has lowest weight (0.2)', () => {
    expect(DEFAULT_SCORE_WEIGHTS.aio).toBe(0.2)
  })
})
