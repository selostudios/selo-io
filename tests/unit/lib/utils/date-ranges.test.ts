import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getDateRange,
  getPreviousPeriodRange,
  getCalendarQuarterRange,
  getPreviousQuarterRange,
  calculatePercentageChange,
  getYesterdayRange,
  getSyncDateRange,
} from '@/lib/utils/date-ranges'

describe('date-ranges', () => {
  beforeEach(() => {
    // Mock current date to 2026-01-15
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getDateRange', () => {
    it('should return last 7 days range', () => {
      const range = getDateRange('7d')
      expect(range.start.toISOString().split('T')[0]).toBe('2026-01-09')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-01-15')
    })

    it('should return last 30 days range', () => {
      const range = getDateRange('30d')
      expect(range.start.toISOString().split('T')[0]).toBe('2025-12-17')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-01-15')
    })

    it('should return current quarter range', () => {
      const range = getDateRange('quarter')
      expect(range.start.toISOString().split('T')[0]).toBe('2026-01-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-01-15')
    })
  })

  describe('getPreviousPeriodRange', () => {
    it('should return previous 7 days for 7d period', () => {
      const current = getDateRange('7d')
      const previous = getPreviousPeriodRange(current, '7d')
      expect(previous.start.toISOString().split('T')[0]).toBe('2026-01-02')
      expect(previous.end.toISOString().split('T')[0]).toBe('2026-01-08')
    })
  })

  describe('getCalendarQuarterRange', () => {
    it('should return Q1 for January', () => {
      const range = getCalendarQuarterRange(new Date('2026-01-15'))
      expect(range.start.toISOString().split('T')[0]).toBe('2026-01-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-03-31')
    })

    it('should return Q2 for May', () => {
      const range = getCalendarQuarterRange(new Date('2026-05-15'))
      expect(range.start.toISOString().split('T')[0]).toBe('2026-04-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2026-06-30')
    })
  })

  describe('getPreviousQuarterRange', () => {
    it('should return Q4 2025 for Q1 2026', () => {
      const range = getPreviousQuarterRange(new Date('2026-01-15'))
      expect(range.start.toISOString().split('T')[0]).toBe('2025-10-01')
      expect(range.end.toISOString().split('T')[0]).toBe('2025-12-31')
    })
  })

  describe('calculatePercentageChange', () => {
    it('returns positive change for growth', () => {
      expect(calculatePercentageChange(150, 100)).toBe(50)
    })

    it('returns negative change for decline', () => {
      expect(calculatePercentageChange(50, 100)).toBe(-50)
    })

    it('returns null when both are zero', () => {
      expect(calculatePercentageChange(0, 0)).toBeNull()
    })

    it('returns 100 when previous is zero and current is positive', () => {
      expect(calculatePercentageChange(50, 0)).toBe(100)
    })
  })

  describe('getYesterdayRange', () => {
    it('returns a range spanning all of yesterday', () => {
      const { start, end } = getYesterdayRange()
      const today = new Date()
      const expectedDate = new Date(today)
      expectedDate.setDate(expectedDate.getDate() - 1)

      expect(start.getDate()).toBe(expectedDate.getDate())
      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
      expect(end.getSeconds()).toBe(59)
    })
  })

  describe('getSyncDateRange', () => {
    it('defaults to yesterday when no target date provided', () => {
      const { start } = getSyncDateRange()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(start.getDate()).toBe(yesterday.getDate())
    })

    it('uses provided target date', () => {
      const target = new Date(2026, 0, 10) // Jan 10, 2026
      const { start, end } = getSyncDateRange(target)
      expect(start.getDate()).toBe(10)
      expect(start.getMonth()).toBe(0)
      expect(end.getHours()).toBe(23)
    })
  })
})
