'use client'

import { SlideContainer } from '../slide-container'

interface NextStepsSlideProps {
  companyName?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  accentColor?: string | null
}

export function NextStepsSlide({
  companyName,
  logoUrl,
  primaryColor,
  accentColor,
}: NextStepsSlideProps) {
  const displayName = companyName || 'Selo Studios'

  // Use brand colors for gradient background
  const gradientFrom = accentColor || primaryColor || '#4f46e5' // indigo-600
  const gradientTo = primaryColor || '#7c3aed' // violet-600

  return (
    <SlideContainer
      className="text-white"
      style={{
        background: `linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo})`,
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="mb-8 text-4xl font-bold text-white md:text-5xl">
          Ready to Improve
          <br />
          Your Results?
        </h2>

        <p className="mb-12 max-w-2xl text-lg text-white/80 md:text-xl">
          We&apos;ve identified the opportunities. Now let&apos;s turn them into results. Our team
          is ready to help you implement these recommendations and track your progress.
        </p>

        <div className="mb-12 rounded-2xl bg-white/10 p-8 backdrop-blur">
          <div className="mb-6 flex justify-center">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element -- User-provided external URL, can't configure all domains */
              <img
                src={logoUrl}
                alt={displayName}
                className="h-12 w-auto object-contain brightness-0 invert"
              />
            ) : (
              <div className="text-2xl font-bold text-white">{displayName}</div>
            )}
          </div>

          <div className="space-y-2 text-white/90">
            <p className="font-medium">Let&apos;s discuss your roadmap</p>
            <p className="text-white/70">hello@selo.io</p>
          </div>
        </div>

        <p className="text-sm text-white/50">
          Thank you for reviewing this report. We look forward to helping you succeed.
        </p>
      </div>
    </SlideContainer>
  )
}
