'use client'

import { SlideContainer } from '../slide-container'

interface CoverSlideProps {
  domain: string
  date: string
  customLogoUrl?: string | null
  customCompanyName?: string | null
}

export function CoverSlide({ domain, date, customLogoUrl, customCompanyName }: CoverSlideProps) {
  const companyName = customCompanyName || 'Selo Studios'
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <SlideContainer variant="dark" className="relative overflow-hidden">
      {/* Abstract geometric background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Large rotated logo shape */}
        <div
          className="absolute -top-32 -left-32 h-[500px] w-[500px] rotate-45 rounded-3xl bg-white/5"
          style={{ transform: 'rotate(45deg)' }}
        />
        {/* Accent shapes */}
        <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col justify-between">
        {/* Top: Logo/Company */}
        <div className="flex items-start justify-between">
          {customLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element -- User-provided external URL, can't configure all domains */
            <img src={customLogoUrl} alt={companyName} className="h-12 w-auto object-contain" />
          ) : (
            <div className="text-xl font-bold tracking-tight text-white/90">{companyName}</div>
          )}
        </div>

        {/* Center: Main content */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
            Marketing Performance
            <br />
            Report
          </h1>
          <div className="mt-8 text-xl text-white/70 md:text-2xl">{domain}</div>
        </div>

        {/* Bottom: Date */}
        <div className="text-center text-sm text-white/50">{formattedDate}</div>
      </div>
    </SlideContainer>
  )
}
