import { GaMetricStrip } from './ga-metric-strip'
import { GaMetricTable } from './ga-metric-table'
import { SlideLayout } from './slide-layout'
import type { GAData } from '@/lib/reviews/types'

export interface GaBodySlideProps {
  narrative: string
  data: GAData | undefined
  mode: 'screen' | 'print'
}

/**
 * GA-specific body slide. The `mode` prop is exclusive — screen renders the
 * interactive metric strip, print renders a compact text table. ReviewDeck
 * builds separate screen/print subtrees, so rendering both here would
 * duplicate the narrative DOM.
 */
export function GaBodySlide({ narrative, data, mode }: GaBodySlideProps) {
  return (
    <SlideLayout
      heading="Google Analytics"
      body={mode === 'screen' ? <GaMetricStrip data={data} /> : <GaMetricTable data={data} />}
      narrative={narrative}
      narrativeTestId="ga-body-slide-content"
    />
  )
}
