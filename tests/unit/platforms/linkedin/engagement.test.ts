import { describe, test, expect } from 'vitest'
import { computeEngagementRate } from '@/lib/platforms/linkedin/engagement'

describe('computeEngagementRate', () => {
  test('returns (reactions + comments + shares) / impressions', () => {
    expect(
      computeEngagementRate({ reactions: 10, comments: 5, shares: 5, impressions: 1000 })
    ).toBeCloseTo(0.02, 5)
  })

  test('returns null when impressions is zero', () => {
    expect(
      computeEngagementRate({ reactions: 3, comments: 0, shares: 0, impressions: 0 })
    ).toBeNull()
  })

  test('returns null when impressions is negative', () => {
    expect(
      computeEngagementRate({ reactions: 3, comments: 0, shares: 0, impressions: -1 })
    ).toBeNull()
  })

  test('treats missing counts as zero', () => {
    expect(computeEngagementRate({ impressions: 100 })).toBe(0)
  })
})
