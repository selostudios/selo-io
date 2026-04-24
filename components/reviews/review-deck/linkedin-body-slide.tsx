import { LinkedInMetricStrip } from './linkedin-metric-strip'
import { LinkedInMetricTable } from './linkedin-metric-table'
import { SlideNarrative } from './slide-narrative'
import type { LinkedInData } from '@/lib/reviews/types'

export interface LinkedInBodySlideProps {
  narrative: string
  data: LinkedInData | undefined
  mode: 'screen' | 'print'
}

/**
 * LinkedIn-specific body slide for the quarterly performance deck. Mirrors
 * `GaBodySlide`: outer container, accent heading, metric slot between heading
 * and narrative. Screen mode renders the interactive strip; print mode renders
 * a compact table.
 */
export function LinkedInBodySlide({ narrative, data, mode }: LinkedInBodySlideProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-8 py-12 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        LinkedIn
      </h2>

      {mode === 'screen' ? (
        <LinkedInMetricStrip data={data} />
      ) : (
        <LinkedInMetricTable data={data} />
      )}

      <SlideNarrative text={narrative} testId="linkedin-body-slide-content" />
    </div>
  )
}
