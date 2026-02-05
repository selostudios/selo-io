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

export function CoverSlide({
  domain,
  date,
  logoUrl,
  companyName,
  primaryColor,
  secondaryColor,
  accentColor,
}: CoverSlideProps) {
  const displayName = companyName || 'Selo Studios'
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Use brand colors for styling, with sensible fallbacks
  const bgColor = primaryColor || '#1e293b' // slate-800 fallback
  const textColor = secondaryColor || '#ffffff'
  const highlightColor = accentColor || primaryColor || '#6366f1' // indigo fallback

  return (
    <SlideContainer className="relative overflow-hidden" style={{ backgroundColor: bgColor }}>
      {/* Abstract geometric background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large rotated shape */}
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rotate-45 rounded-3xl"
          style={{ backgroundColor: `${textColor}08` }}
        />
        {/* Accent shapes - use brand accent color */}
        <div
          className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: `${highlightColor}20` }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 h-48 w-48 rounded-full blur-3xl"
          style={{ backgroundColor: `${highlightColor}20` }}
        />
      </div>

      {/* Content - Logo at top, title centered, domain below */}
      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-center text-center"
        style={{ color: textColor }}
      >
        {/* Logo/Company at top */}
        <div className="mb-12">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- User-provided external URL, can't configure all domains */
            <img
              src={logoUrl}
              alt={displayName}
              className="mx-auto h-16 w-auto object-contain md:h-20"
            />
          ) : (
            <div className="text-2xl font-bold tracking-tight md:text-3xl" style={{ opacity: 0.9 }}>
              {displayName}
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Marketing Performance
          <br />
          Report
        </h1>

        {/* Domain */}
        <div className="mt-8 text-xl md:text-2xl" style={{ opacity: 0.7 }}>
          {domain}
        </div>

        {/* Date at bottom */}
        <div className="mt-12 text-sm" style={{ opacity: 0.5 }}>
          {formattedDate}
        </div>
      </div>
    </SlideContainer>
  )
}
