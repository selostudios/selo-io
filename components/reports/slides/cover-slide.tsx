'use client'

import { SlideContainer } from '../slide-container'

interface CoverSlideProps {
  domain: string
  date: string
  logoUrl?: string | null
  companyName?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
}

export function CoverSlide({ domain, date, logoUrl, companyName, accentColor }: CoverSlideProps) {
  const displayName = companyName || 'Selo Studios'
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <SlideContainer variant="light">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- User-provided external URL, can't configure all domains */
          <img
            src={logoUrl}
            alt={displayName}
            className="mb-4 h-24 w-auto object-contain md:h-32 lg:h-40"
          />
        ) : (
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
            {displayName}
          </h1>
        )}

        <p
          className="text-base font-medium tracking-widest uppercase md:text-lg lg:text-xl"
          style={{ color: accentColor || 'var(--foreground)' }}
        >
          Marketing Performance Report
        </p>

        <p className="text-foreground text-xl font-semibold md:text-3xl lg:text-4xl">{domain}</p>

        <p className="text-muted-foreground text-base md:text-lg lg:text-xl">{formattedDate}</p>
      </div>
    </SlideContainer>
  )
}
