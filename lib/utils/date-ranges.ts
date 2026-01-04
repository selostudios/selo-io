export type DateRangePeriod = '7d' | '30d' | 'quarter'

export interface DateRange {
  start: Date
  end: Date
}

export function getDateRange(period: DateRangePeriod): DateRange {
  const now = new Date()
  // Use UTC to avoid timezone issues
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))

  if (period === '7d') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6, 0, 0, 0, 0))
    return { start, end }
  }

  if (period === '30d') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29, 0, 0, 0, 0))
    return { start, end }
  }

  // Quarter - from start of current quarter to today
  const quarterStart = getCalendarQuarterRange(now).start
  return { start: quarterStart, end }
}

export function getPreviousPeriodRange(currentRange: DateRange, period: DateRangePeriod): DateRange {
  if (period === 'quarter') {
    return getPreviousQuarterRange(currentRange.start)
  }

  const daysDiff = Math.ceil((currentRange.end.getTime() - currentRange.start.getTime()) / (1000 * 60 * 60 * 24))

  const startYear = currentRange.start.getUTCFullYear()
  const startMonth = currentRange.start.getUTCMonth()
  const startDay = currentRange.start.getUTCDate()

  const end = new Date(Date.UTC(startYear, startMonth, startDay - 1, 23, 59, 59, 999))
  const start = new Date(Date.UTC(startYear, startMonth, startDay - daysDiff, 0, 0, 0, 0))

  return { start, end }
}

export function getCalendarQuarterRange(date: Date): DateRange {
  const month = date.getUTCMonth()
  const year = date.getUTCFullYear()

  const quarterStartMonth = Math.floor(month / 3) * 3
  const quarterEndMonth = quarterStartMonth + 2

  const start = new Date(Date.UTC(year, quarterStartMonth, 1, 0, 0, 0, 0))
  // Last day of the quarter: day 0 of next month gives last day of previous month
  const end = new Date(Date.UTC(year, quarterEndMonth + 1, 0, 23, 59, 59, 999))

  return { start, end }
}

export function getPreviousQuarterRange(date: Date): DateRange {
  const month = date.getUTCMonth()
  const year = date.getUTCFullYear()

  const currentQuarter = Math.floor(month / 3)

  let prevQuarterStartMonth: number
  let prevYear: number

  if (currentQuarter === 0) {
    // Q1 -> previous Q4
    prevQuarterStartMonth = 9 // October
    prevYear = year - 1
  } else {
    prevQuarterStartMonth = (currentQuarter - 1) * 3
    prevYear = year
  }

  const start = new Date(Date.UTC(prevYear, prevQuarterStartMonth, 1, 0, 0, 0, 0))
  // Last day of the quarter
  const end = new Date(Date.UTC(prevYear, prevQuarterStartMonth + 3, 0, 23, 59, 59, 999))

  return { start, end }
}

export function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null
  }
  return ((current - previous) / previous) * 100
}
