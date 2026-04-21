export interface DateRange {
  start: string
  end: string
}

export interface QuarterPeriods {
  main: DateRange
  qoq: DateRange
  yoy: DateRange
}

export function parseQuarter(input: string): { year: number; quarter: number } {
  const m = input.match(/^(\d{4})-Q([1-4])$/)
  if (!m) throw new Error(`Invalid quarter: ${input}`)
  return { year: Number(m[1]), quarter: Number(m[2]) }
}

function quarterRange(year: number, quarter: number): DateRange {
  const startMonth = (quarter - 1) * 3
  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 3, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export function periodsForQuarter(quarter: string): QuarterPeriods {
  const { year, quarter: q } = parseQuarter(quarter)
  const main = quarterRange(year, q)
  const priorQ = q === 1 ? 4 : q - 1
  const priorY = q === 1 ? year - 1 : year
  const qoq = quarterRange(priorY, priorQ)
  const yoy = quarterRange(year - 1, q)
  return { main, qoq, yoy }
}

export function currentQuarter(date: Date): string {
  const year = date.getUTCFullYear()
  const q = Math.floor(date.getUTCMonth() / 3) + 1
  return `${year}-Q${q}`
}

/**
 * Formats a stored quarter identifier (`'2026-Q1'`) as a display label
 * (`'Q1 2026'`). Used across the editor, preview, snapshot detail, and
 * snapshots list views so deck headings stay consistent.
 */
export function formatQuarterLabel(quarter: string): string {
  const { year, quarter: q } = parseQuarter(quarter)
  return `Q${q} ${year}`
}

/**
 * Builds the list of quarter identifiers offered when starting a new review.
 * Returns the current quarter first, then walks backwards through prior
 * quarters up to `lookbackYears` earlier.
 */
export function buildQuarterOptions(now: Date, lookbackYears = 2): string[] {
  const { year, quarter } = parseQuarter(currentQuarter(now))
  const options: string[] = []
  for (let yOffset = 0; yOffset <= lookbackYears; yOffset++) {
    for (let q = 4; q >= 1; q--) {
      const y = year - yOffset
      if (yOffset === 0 && q > quarter) continue
      options.push(`${y}-Q${q}`)
    }
  }
  return options
}
