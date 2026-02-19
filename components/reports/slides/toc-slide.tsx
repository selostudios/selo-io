'use client'

import { SlideContainer } from '../slide-container'

interface TocSlideProps {
  onNavigate?: (slideIndex: number) => void
  accentColor?: string | null
}

const sections = [
  { title: 'Your Site at a Glance', slideIndex: 2 },
  { title: 'Executive Summary', slideIndex: 3 },
  { title: 'Opportunities for Improvement', slideIndex: 4 },
  { title: 'Business Impact', slideIndex: 6 },
  { title: 'Recommendations', slideIndex: 7 },
  { title: 'Next Steps', slideIndex: 9 },
]

export function TocSlide({ onNavigate, accentColor }: TocSlideProps) {
  return (
    <SlideContainer variant="light">
      <div className="flex flex-1 flex-col justify-center">
        <div className="w-full max-w-[800px]">
          <h2 className="mb-12 text-3xl font-bold md:text-4xl">Contents</h2>

          <nav className="space-y-4">
            {sections.map((section, index) => (
              <button
                key={section.title}
                onClick={() => onNavigate?.(section.slideIndex)}
                className="group flex w-full items-center justify-between border-b border-slate-200 py-4 text-left transition-colors hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
              >
                <div className="flex items-center gap-6">
                  <span className="text-muted-foreground text-lg font-medium">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-xl font-medium ${!accentColor ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : ''}`}
                    style={
                      accentColor
                        ? ({ '--accent': accentColor, color: 'inherit' } as React.CSSProperties)
                        : undefined
                    }
                    onMouseEnter={
                      accentColor ? (e) => (e.currentTarget.style.color = accentColor) : undefined
                    }
                    onMouseLeave={
                      accentColor ? (e) => (e.currentTarget.style.color = 'inherit') : undefined
                    }
                  >
                    {section.title}
                  </span>
                </div>
                <span className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  →
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </SlideContainer>
  )
}
