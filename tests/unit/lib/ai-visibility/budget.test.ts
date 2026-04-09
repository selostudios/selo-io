import { describe, it, expect } from 'vitest'
import { canContinueSync, checkBudgetThresholds } from '@/lib/ai-visibility/budget'

describe('canContinueSync', () => {
  it('returns true when spend is under budget', () => {
    expect(canContinueSync(5000, 10000)).toBe(true)
  })

  it('returns false when spend meets budget', () => {
    expect(canContinueSync(10000, 10000)).toBe(false)
  })

  it('returns false when spend exceeds budget', () => {
    expect(canContinueSync(12000, 10000)).toBe(false)
  })

  it('returns true when budget is 0 (unlimited)', () => {
    expect(canContinueSync(5000, 0)).toBe(true)
  })
})

describe('checkBudgetThresholds', () => {
  it('returns null when under threshold', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 5000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBeNull()
  })

  it('returns approaching when at threshold', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 9000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBe('approaching')
  })

  it('returns exceeded when over budget', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 10000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBe('exceeded')
  })

  it('returns null when approaching already sent', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 9500,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: 'approaching',
    })
    expect(result).toBeNull()
  })

  it('returns exceeded even if approaching was sent', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 10500,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: 'approaching',
    })
    expect(result).toBe('exceeded')
  })

  it('returns null when exceeded already sent', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 12000,
      budgetCents: 10000,
      thresholdPercent: 90,
      lastAlertType: 'exceeded',
    })
    expect(result).toBeNull()
  })

  it('returns null when budget is 0 (unlimited)', () => {
    const result = checkBudgetThresholds({
      currentSpendCents: 50000,
      budgetCents: 0,
      thresholdPercent: 90,
      lastAlertType: null,
    })
    expect(result).toBeNull()
  })
})
