import { GaMetricStrip } from './ga-metric-strip'
import { GaMetricTable } from './ga-metric-table'
import { SlideNarrative } from './slide-narrative'
import type { GAData } from '@/lib/reviews/types'

export interface GaBodySlideProps {
  narrative: string
  data: GAData | undefined
  mode: 'screen' | 'print'
}

/**
 * GA-specific body slide for the quarterly performance deck. Mirrors the
 * structural markup of `BodySlide` (outer container, accent-coloured heading,
 * shared narrative block) but adds a metric slot between the heading and the
 * narrative.
 *
 * The `mode` prop is exclusive — screen renders the interactive metric strip,
 * print renders a compact table. ReviewDeck builds separate screen/print
 * subtrees, so rendering both here would duplicate the narrative DOM.
 */
export function GaBodySlide({ narrative, data, mode }: GaBodySlideProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-8 py-12 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        Google Analytics
      </h2>

      {mode === 'screen' ? <GaMetricStrip data={data} /> : <GaMetricTable data={data} />}

      <SlideNarrative text={narrative} testId="ga-body-slide-content" />
    </div>
  )
}
