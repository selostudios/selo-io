import { GaMetricStrip } from './ga-metric-strip'
import { GaMetricTable } from './ga-metric-table'
import { parseBodyNarrative, type NarrativeNode } from './parse-body-narrative'
import type { GAData } from '@/lib/reviews/types'

const EMPTY_NARRATIVE_PLACEHOLDER = 'No narrative available for this section'

export interface GaBodySlideProps {
  narrative: string
  data: GAData | undefined
  mode: 'screen' | 'print'
}

/**
 * GA-specific body slide for the quarterly performance deck. Mirrors the
 * structural markup of `BodySlide` (outer container, accent-coloured heading,
 * narrative block) so it visually aligns with the other deck slides, but adds
 * a metric slot between the heading and the narrative.
 *
 * The `mode` prop is exclusive — screen renders the interactive metric strip,
 * print renders a compact table. ReviewDeck builds separate screen/print
 * subtrees, so rendering both here would duplicate the narrative DOM.
 */
export function GaBodySlide({ narrative, data, mode }: GaBodySlideProps) {
  const isEmpty = narrative.trim().length === 0

  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-8 py-12 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        Google Analytics
      </h2>

      {mode === 'screen' ? <GaMetricStrip data={data} /> : <GaMetricTable data={data} />}

      {isEmpty ? (
        <p className="text-muted-foreground text-base italic md:text-lg">
          {EMPTY_NARRATIVE_PLACEHOLDER}
        </p>
      ) : (
        <div
          data-testid="body-slide-content"
          className="text-foreground max-w-3xl space-y-4 text-base leading-relaxed md:text-lg lg:text-xl"
        >
          {renderNarrativeNodes(narrative)}
        </div>
      )}
    </div>
  )
}

function renderNarrativeNodes(text: string): React.ReactNode[] {
  return parseBodyNarrative(text).map((node: NarrativeNode, idx) => {
    if (node.kind === 'list') {
      return (
        <ul key={`ul-${idx}`} className="list-disc space-y-2 pl-6">
          {node.content.map((item, itemIdx) => (
            <li key={itemIdx}>{item}</li>
          ))}
        </ul>
      )
    }
    return <p key={`p-${idx}`}>{node.content}</p>
  })
}
