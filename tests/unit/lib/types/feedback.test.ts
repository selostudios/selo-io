import { describe, it, expect } from 'vitest'
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '@/lib/types/feedback'

describe('Feedback Types', () => {
  describe('CATEGORY_LABELS', () => {
    it('has labels for all categories', () => {
      expect(CATEGORY_LABELS.bug).toBe('Bug')
      expect(CATEGORY_LABELS.feature_request).toBe('Feature Request')
      expect(CATEGORY_LABELS.performance).toBe('Performance')
      expect(CATEGORY_LABELS.usability).toBe('Usability')
      expect(CATEGORY_LABELS.other).toBe('Other')
    })
  })

  describe('STATUS_LABELS', () => {
    it('has labels for all statuses', () => {
      expect(STATUS_LABELS.new).toBe('New')
      expect(STATUS_LABELS.under_review).toBe('Under Review')
      expect(STATUS_LABELS.in_progress).toBe('In Progress')
      expect(STATUS_LABELS.resolved).toBe('Resolved')
      expect(STATUS_LABELS.closed).toBe('Closed')
    })
  })

  describe('PRIORITY_LABELS', () => {
    it('has labels for all priorities', () => {
      expect(PRIORITY_LABELS.critical).toBe('Critical')
      expect(PRIORITY_LABELS.high).toBe('High')
      expect(PRIORITY_LABELS.medium).toBe('Medium')
      expect(PRIORITY_LABELS.low).toBe('Low')
    })
  })

  describe('STATUS_COLORS', () => {
    it('has colors for all statuses', () => {
      expect(STATUS_COLORS.new).toContain('neutral')
      expect(STATUS_COLORS.under_review).toContain('blue')
      expect(STATUS_COLORS.in_progress).toContain('yellow')
      expect(STATUS_COLORS.resolved).toContain('green')
      expect(STATUS_COLORS.closed).toContain('red')
    })
  })

  describe('PRIORITY_COLORS', () => {
    it('has colors for all priorities', () => {
      expect(PRIORITY_COLORS.critical).toContain('red')
      expect(PRIORITY_COLORS.high).toContain('orange')
      expect(PRIORITY_COLORS.medium).toContain('yellow')
      expect(PRIORITY_COLORS.low).toContain('neutral')
    })
  })

  describe('Options arrays', () => {
    it('CATEGORY_OPTIONS has correct structure', () => {
      expect(CATEGORY_OPTIONS).toHaveLength(5)
      expect(CATEGORY_OPTIONS[0]).toEqual({ value: 'bug', label: 'Bug' })
    })

    it('STATUS_OPTIONS has correct structure', () => {
      expect(STATUS_OPTIONS).toHaveLength(5)
      expect(STATUS_OPTIONS[0]).toEqual({ value: 'new', label: 'New' })
    })

    it('PRIORITY_OPTIONS has correct structure', () => {
      expect(PRIORITY_OPTIONS).toHaveLength(4)
      expect(PRIORITY_OPTIONS[0]).toEqual({ value: 'critical', label: 'Critical' })
    })
  })
})
