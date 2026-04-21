'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Printer, Share2, X } from 'lucide-react'
import { useBuildOrgHref } from '@/hooks/use-org-context'
import { Button } from '@/components/ui/button'
import { Slide } from '@/components/deck/slide'
import { DeckControls } from '@/components/deck/deck-controls'
import { useDeckNavigation } from '@/components/deck/use-deck-navigation'
import { getFullscreenElement, toggleElementFullscreen } from '@/components/deck/fullscreen'
import { DeckPrintStyles } from '@/components/deck/print-styles'
import type { ReportPresentationData } from '@/lib/reports/types'

const CoverSlide = dynamic(() => import('./slides/cover-slide').then((m) => m.CoverSlide))
const TocSlide = dynamic(() => import('./slides/toc-slide').then((m) => m.TocSlide))
const AtAGlanceSlide = dynamic(() =>
  import('./slides/at-a-glance-slide').then((m) => m.AtAGlanceSlide)
)
const ExecutiveSummarySlide = dynamic(() =>
  import('./slides/executive-summary-slide').then((m) => m.ExecutiveSummarySlide)
)
const OpportunitiesSlide = dynamic(() =>
  import('./slides/opportunities-slide').then((m) => m.OpportunitiesSlide)
)
const BusinessImpactSlide = dynamic(() =>
  import('./slides/business-impact-slide').then((m) => m.BusinessImpactSlide)
)
const RecommendationsSlide = dynamic(() =>
  import('./slides/recommendations-slide').then((m) => m.RecommendationsSlide)
)
const NextStepsSlide = dynamic(() =>
  import('./slides/next-steps-slide').then((m) => m.NextStepsSlide)
)

interface ReportPresentationProps {
  data: ReportPresentationData
  isPublic?: boolean
  onShare?: () => void
}

interface BuiltSlide {
  key: string
  heading: string
  render: (goTo: (i: number) => void) => React.ReactNode
}

function buildSlides(data: ReportPresentationData): BuiltSlide[] {
  const opportunityPages = Math.ceil(data.opportunities.length / 6) || 1
  const recommendationPages = Math.ceil(data.recommendations.length / 5) || 1

  const slides: BuiltSlide[] = [
    {
      key: 'cover',
      heading: 'Cover',
      render: () => (
        <CoverSlide
          domain={data.domain}
          date={data.created_at}
          logoUrl={data.logo_url}
          companyName={data.company_name}
          primaryColor={data.primary_color}
          secondaryColor={data.secondary_color}
          accentColor={data.accent_color}
        />
      ),
    },
    {
      key: 'toc',
      heading: 'Table of contents',
      render: (goTo) => <TocSlide onNavigate={goTo} accentColor={data.accent_color} />,
    },
    {
      key: 'at-a-glance',
      heading: 'At a glance',
      render: () => (
        <AtAGlanceSlide
          combinedScore={data.combined_score}
          seoScore={data.scores.seo.score}
          pageSpeedScore={data.scores.page_speed.score}
          aioScore={data.scores.aio.score}
        />
      ),
    },
    {
      key: 'executive-summary',
      heading: 'Executive summary',
      render: () => (
        <ExecutiveSummarySlide
          summary={data.executive_summary}
          stats={data.stats}
          accentColor={data.accent_color}
        />
      ),
    },
  ]

  for (let page = 0; page < opportunityPages; page++) {
    slides.push({
      key: `opportunities-${page}`,
      heading: `Opportunities${opportunityPages > 1 ? ` (${page + 1})` : ''}`,
      render: () => <OpportunitiesSlide opportunities={data.opportunities} page={page} />,
    })
  }

  slides.push({
    key: 'business-impact',
    heading: 'Business impact',
    render: () => (
      <BusinessImpactSlide
        projections={data.projections}
        combinedScore={data.combined_score}
        accentColor={data.accent_color}
      />
    ),
  })

  for (let page = 0; page < recommendationPages; page++) {
    slides.push({
      key: `recommendations-${page}`,
      heading: `Recommendations${recommendationPages > 1 ? ` (${page + 1})` : ''}`,
      render: () => (
        <RecommendationsSlide
          recommendations={data.recommendations}
          page={page}
          accentColor={data.accent_color}
        />
      ),
    })
  }

  slides.push({
    key: 'next-steps',
    heading: 'Next steps',
    render: () => (
      <NextStepsSlide
        companyName={data.company_name}
        logoUrl={data.logo_url}
        primaryColor={data.primary_color}
        accentColor={data.accent_color}
      />
    ),
  })

  return slides
}

export function ReportPresentation({ data, isPublic = false, onShare }: ReportPresentationProps) {
  const router = useRouter()
  const buildOrgHref = useBuildOrgHref()
  const deckRef = useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const slides = useMemo(() => buildSlides(data), [data])
  const { currentIndex, next, prev, goTo, isFirst, isLast } = useDeckNavigation(slides.length)

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(getFullscreenElement() === deckRef.current)
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    toggleElementFullscreen(deckRef.current)
  }, [])

  const rootStyle = {
    '--deck-accent': data.accent_color ?? 'var(--foreground)',
  } as CSSProperties

  const slideWidthPercent = 100 / Math.max(slides.length, 1)
  const trackTransform = `translateX(-${currentIndex * slideWidthPercent}%)`

  const announcement = useMemo(() => {
    const heading = slides[currentIndex]?.heading ?? ''
    return `Slide ${currentIndex + 1} of ${slides.length}: ${heading}`
  }, [currentIndex, slides])

  return (
    <div
      ref={deckRef}
      role="region"
      aria-roledescription="slide deck"
      aria-label="Marketing performance report"
      data-testid="report-deck"
      className="bg-background relative h-[calc(100vh-4rem)] w-full overflow-hidden rounded-lg border lg:aspect-video lg:h-auto"
      style={rootStyle}
    >
      <div className="screen-only h-full w-full">
        <div
          data-testid="report-deck-track"
          data-current-index={currentIndex}
          className="flex h-full transition-transform duration-[400ms] ease-out"
          style={{
            width: `${slides.length * 100}%`,
            transform: trackTransform,
          }}
        >
          {slides.map((slide, i) => (
            <Slide
              key={slide.key}
              index={i + 1}
              total={slides.length}
              ariaHeading={slide.heading}
              widthPercent={slideWidthPercent}
            >
              {slide.render(goTo)}
            </Slide>
          ))}
        </div>
      </div>

      <div className="print-only">
        {slides.map((slide) => (
          <div key={slide.key} className="print-slide">
            {slide.render(goTo)}
          </div>
        ))}
      </div>

      <div
        data-testid="report-deck-live-region"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>

      <div className="print:hidden">
        <DeckControls
          onPrev={prev}
          onNext={next}
          onToggleFullscreen={toggleFullscreen}
          isFirst={isFirst}
          isLast={isLast}
          isFullscreen={isFullscreen}
        />
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 print:hidden">
        {!isPublic && onShare && (
          <Button variant="outline" size="sm" onClick={onShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        {!isPublic && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(buildOrgHref('/reports/audit'))}
            aria-label="Close report"
            className="h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <DeckPrintStyles />
    </div>
  )
}
