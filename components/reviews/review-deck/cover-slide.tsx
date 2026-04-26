import { format, parseISO } from 'date-fns'

export interface CoverSlideProps {
  organization: {
    name: string
    logo_url: string | null
  }
  quarter: string
  periodStart: string
  periodEnd: string
  subtitle?: string
}

/**
 * Title slide for a performance review deck. Shows either the org logo or
 * the org name (logo wins if set), the static "Quarterly Performance Review"
 * label, the quarter string, a formatted period range, and optional
 * AI-generated subtitle.
 */
export function CoverSlide({
  organization,
  quarter,
  periodStart,
  periodEnd,
  subtitle,
}: CoverSlideProps) {
  const trimmedSubtitle = subtitle?.trim()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-8 py-12 text-center md:px-16 lg:px-24">
      {organization.logo_url ? (
        // Using a plain <img> so the deck works in any consumer (including
        // the public share route and fullscreen mode) without Next.js image
        // optimization assumptions. Logos are small and already hosted on a
        // CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={organization.logo_url}
          alt={organization.name}
          className="mb-4 h-16 w-auto object-contain md:h-20 lg:h-24"
        />
      ) : (
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
          {organization.name}
        </h1>
      )}

      <p
        className="text-base font-medium tracking-widest uppercase md:text-lg lg:text-xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        Quarterly Performance Review
      </p>

      <p className="text-foreground text-xl font-semibold md:text-3xl lg:text-4xl">{quarter}</p>

      <p className="text-muted-foreground text-base md:text-lg lg:text-xl">
        {formatPeriodRange(periodStart, periodEnd)}
      </p>

      {trimmedSubtitle && (
        <p className="text-foreground mt-6 max-w-2xl text-base leading-relaxed md:text-lg lg:text-xl">
          {trimmedSubtitle}
        </p>
      )}
    </div>
  )
}

/**
 * Formats a pair of ISO dates as "MMM d – MMM d, yyyy" or, when both dates
 * share the same year, "MMM d – MMM d, yyyy" with the year shown only once.
 *
 * Examples:
 *   formatPeriodRange('2026-01-01', '2026-03-31') → "Jan 1 – Mar 31, 2026"
 *   formatPeriodRange('2025-12-01', '2026-02-28') → "Dec 1, 2025 – Feb 28, 2026"
 */
function formatPeriodRange(startIso: string, endIso: string): string {
  const start = parseISO(startIso)
  const end = parseISO(endIso)

  const sameYear = start.getFullYear() === end.getFullYear()

  if (sameYear) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }

  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}
