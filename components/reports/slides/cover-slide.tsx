'use client'

import { SlideContainer } from '../slide-container'

interface CoverSlideProps {
  domain: string
  date: string
  customLogoUrl?: string | null
  customCompanyName?: string | null
  primaryColor?: string | null
}

export function CoverSlide({
  domain,
  date,
  customLogoUrl,
  customCompanyName,
  primaryColor,
}: CoverSlideProps) {
  const companyName = customCompanyName || 'Selo Studios'
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Use brand color for accents, fallback to indigo
  const accentColor = primaryColor || '#6366f1'

  return (
    <SlideContainer variant="dark" className="relative overflow-hidden">
      {/* Abstract geometric background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large rotated logo shape */}
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rotate-45 rounded-3xl bg-white/5"
          style={{ transform: 'rotate(45deg)' }}
        />
        {/* Accent shapes - use brand color */}
        <div
          className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full blur-3xl"
          style={{ backgroundColor: `${accentColor}1a` }}
        />
        <div
          className="absolute bottom-1/4 left-1/3 h-48 w-48 rounded-full blur-3xl"
          style={{ backgroundColor: `${accentColor}1a` }}
        />
      </div>

      {/* Content - Logo at top, title centered, domain below */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        {/* Logo/Company at top */}
        <div className="mb-12">
          {customLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- User-provided external URL, can't configure all domains */
            <img
              src={customLogoUrl}
              alt={companyName}
              className="mx-auto h-16 w-auto object-contain md:h-20"
            />
          ) : (
            <div className="text-2xl font-bold tracking-tight text-white/90 md:text-3xl">
              {companyName}
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
          Marketing Performance
          <br />
          Report
        </h1>

        {/* Domain */}
        <div className="mt-8 text-xl text-white/70 md:text-2xl">{domain}</div>

        {/* Date at bottom */}
        <div className="mt-12 text-sm text-white/50">{formattedDate}</div>
      </div>
    </SlideContainer>
  )
}
