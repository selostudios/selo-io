import { LinkedInMetricStrip } from './linkedin-metric-strip'
import { LinkedInMetricTable } from './linkedin-metric-table'
import { SlideLayout } from './slide-layout'
import type { LinkedInData } from '@/lib/reviews/types'

export interface LinkedInBodySlideProps {
  narrative: string
  data: LinkedInData | undefined
  mode: 'screen' | 'print'
}

/**
 * LinkedIn-specific body slide. Screen mode renders the interactive strip;
 * print mode renders a compact table.
 */
export function LinkedInBodySlide({ narrative, data, mode }: LinkedInBodySlideProps) {
  return (
    <SlideLayout
      heading="LinkedIn"
      body={
        mode === 'screen' ? (
          <LinkedInMetricStrip data={data} />
        ) : (
          <LinkedInMetricTable data={data} />
        )
      }
      narrative={narrative}
      narrativeTestId="linkedin-body-slide-content"
    />
  )
}
