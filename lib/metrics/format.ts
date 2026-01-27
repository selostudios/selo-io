import { Period } from '@/lib/enums'

/**
 * Format a percentage change value for display.
 * Returns empty string if change is null.
 */
export function formatChange(change: number | null): string {
  if (change === null) return ''
  const sign = change >= 0 ? '+' : ''
  return ` (${sign}${change.toFixed(1)}%)`
}

/**
 * Get human-readable label for a period.
 */
export function getPeriodLabel(period: Period): string {
  switch (period) {
    case Period.SevenDays:
      return 'Last 7 days'
    case Period.ThirtyDays:
      return 'Last 30 days'
    case Period.Quarter:
      return 'This quarter'
    default:
      return period
  }
}

/**
 * Format a number with locale-specific separators.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString()
}

/**
 * Format a currency value.
 */
export function formatCurrency(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
