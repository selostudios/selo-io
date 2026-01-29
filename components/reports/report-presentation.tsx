'use client'

import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Share2, Printer, X, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressDots } from './progress-dots'
import type { ReportPresentationData } from '@/lib/reports/types'

// Import slides
import {
  CoverSlide,
  TocSlide,
  AtAGlanceSlide,
  ExecutiveSummarySlide,
  OpportunitiesSlide,
  BusinessImpactSlide,
  RecommendationsSlide,
  NextStepsSlide,
} from './slides'

interface ReportPresentationProps {
  data: ReportPresentationData
  isPublic?: boolean
  onShare?: () => void
}

export function ReportPresentation({ data, isPublic = false, onShare }: ReportPresentationProps) {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Calculate total slides based on content
  const opportunityPages = Math.ceil(data.opportunities.length / 6) || 1
  const recommendationPages = Math.ceil(data.recommendations.length / 5) || 1
  const totalSlides = 4 + opportunityPages + 1 + recommendationPages + 1 // Cover, ToC, AtAGlance, Summary, Opportunities, Impact, Recommendations, NextSteps

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1))
  }, [totalSlides])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0))
  }, [])

  const goToSlide = useCallback(
    (index: number) => {
      setCurrentSlide(Math.max(0, Math.min(index, totalSlides - 1)))
    },
    [totalSlides]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault()
          nextSlide()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prevSlide()
          break
        case 'Escape':
          if (!isPublic) {
            router.push('/seo/reports')
          }
          break
        case 'Home':
          e.preventDefault()
          goToSlide(0)
          break
        case 'End':
          e.preventDefault()
          goToSlide(totalSlides - 1)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextSlide, prevSlide, goToSlide, totalSlides, router, isPublic])

  // Touch/swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return

    const touchEnd = e.changedTouches[0].clientX
    const diff = touchStart - touchEnd

    // Minimum swipe distance
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextSlide()
      } else {
        prevSlide()
      }
    }

    setTouchStart(null)
  }

  const handlePrint = () => {
    window.print()
  }

  // Render a specific slide by index
  const renderSlideByIndex = (index: number): ReactNode => {
    let slideIndex = 0

    // Slide 0: Cover
    if (index === slideIndex++) {
      return (
        <CoverSlide
          domain={data.domain}
          date={data.created_at}
          customLogoUrl={data.custom_logo_url}
          customCompanyName={data.custom_company_name}
        />
      )
    }

    // Slide 1: Table of Contents
    if (index === slideIndex++) {
      return <TocSlide onNavigate={goToSlide} />
    }

    // Slide 2: At a Glance
    if (index === slideIndex++) {
      return (
        <AtAGlanceSlide
          combinedScore={data.combined_score}
          seoScore={data.scores.seo.score}
          pageSpeedScore={data.scores.page_speed.score}
          aioScore={data.scores.aio.score}
        />
      )
    }

    // Slide 3: Executive Summary
    if (index === slideIndex++) {
      return <ExecutiveSummarySlide summary={data.executive_summary} stats={data.stats} />
    }

    // Slides 4-N: Opportunities (paginated)
    for (let page = 0; page < opportunityPages; page++) {
      if (index === slideIndex++) {
        return <OpportunitiesSlide opportunities={data.opportunities} page={page} />
      }
    }

    // Slide: Business Impact
    if (index === slideIndex++) {
      return (
        <BusinessImpactSlide projections={data.projections} combinedScore={data.combined_score} />
      )
    }

    // Slides: Recommendations (paginated)
    for (let page = 0; page < recommendationPages; page++) {
      if (index === slideIndex++) {
        return <RecommendationsSlide recommendations={data.recommendations} page={page} />
      }
    }

    // Final Slide: Next Steps
    return (
      <NextStepsSlide
        customCompanyName={data.custom_company_name}
        customLogoUrl={data.custom_logo_url}
      />
    )
  }

  // Render all slides for printing
  const renderAllSlides = (): ReactNode[] => {
    return Array.from({ length: totalSlides }, (_, i) => (
      <div key={i} className="print-slide">
        {renderSlideByIndex(i)}
      </div>
    ))
  }

  // Use full viewport height for public/fullscreen, or calc for authenticated layout
  const containerHeight = isFullscreen || isPublic ? 'h-screen' : 'h-[calc(100vh-4rem)]'

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-white dark:bg-slate-950'
          : `relative ${containerHeight} w-full overflow-hidden`
      }
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Current Slide - visible on screen, hidden when printing */}
      <div className="screen-only h-full w-full overflow-y-auto">
        {renderSlideByIndex(currentSlide)}
      </div>

      {/* All Slides - hidden on screen, visible when printing */}
      <div className="print-only">{renderAllSlides()}</div>

      {/* Navigation Arrows */}
      <div className="print:hidden">
        {currentSlide > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={prevSlide}
            className="absolute top-1/2 left-4 z-50 h-12 w-12 -translate-y-1/2 rounded-full bg-white/80 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        {currentSlide < totalSlides - 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={nextSlide}
            className="absolute top-1/2 right-4 z-50 h-12 w-12 -translate-y-1/2 rounded-full bg-white/80 shadow-lg backdrop-blur hover:bg-white dark:bg-slate-900/80 dark:hover:bg-slate-900"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Progress Dots */}
      <ProgressDots current={currentSlide} total={totalSlides} onNavigate={goToSlide} />

      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 print:hidden">
        {!isPublic && onShare && (
          <Button variant="outline" size="sm" onClick={onShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>

        {!isPublic && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-9 w-9"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}

        {!isPublic && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/seo/reports')}
            className="h-9 w-9"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Print Styles - render all slides for printing */}
      <style jsx global>{`
        /* Screen-only elements hidden during print */
        .print-only {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }

          /* Hide screen-only content */
          .screen-only,
          .print\\:hidden {
            display: none !important;
          }

          /* Show print-only content */
          .print-only {
            display: block !important;
          }

          html,
          body {
            width: 100%;
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-slide {
            width: 100%;
            height: 100vh;
            min-height: 100vh;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            overflow: hidden;
            box-sizing: border-box;
          }

          .print-slide:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
        }
      `}</style>
    </div>
  )
}
