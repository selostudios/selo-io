import { Fragment } from 'react'

export const EMPTY_NARRATIVE_PLACEHOLDER = 'No narrative available for this section'

export interface BodySlideProps {
  heading: string
  text: string
}

/**
 * Renders a deck body slide: a heading + a narrative block.
 *
 * The narrative is plain text. Lines that start with "- " (dash + space) render
 * as a single `<ul>` list. Non-bullet lines between blank lines form paragraphs.
 * Blank lines act as separators between paragraphs, but consecutive bullet
 * lines always collapse into one list regardless of blank spacing.
 */
export function BodySlide({ heading, text }: BodySlideProps) {
  const isEmpty = text.trim().length === 0

  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-8 py-12 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        {heading}
      </h2>

      {isEmpty ? (
        <p className="text-muted-foreground text-base italic md:text-lg">
          {EMPTY_NARRATIVE_PLACEHOLDER}
        </p>
      ) : (
        <div
          data-testid="body-slide-content"
          className="text-foreground max-w-3xl space-y-4 text-base leading-relaxed md:text-lg lg:text-xl"
        >
          {renderNarrativeNodes(text)}
        </div>
      )}
    </div>
  )
}

/**
 * Single-pass conversion of plain-text narrative into a list of React nodes.
 *
 * - Lines matching `^- ` (after trimming leading spaces) are treated as list
 *   items. Consecutive bullet lines collapse into a single `<ul>`.
 * - Blank lines are separators and produce no node.
 * - Any other non-blank line becomes its own `<p>` paragraph.
 */
function renderNarrativeNodes(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []

  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    const items = listBuffer.slice()
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="list-disc space-y-2 pl-6">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    )
    listBuffer = []
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()

    if (trimmed.startsWith('- ')) {
      listBuffer.push(trimmed.slice(2).trim())
      continue
    }

    // Non-bullet: close any list we were building.
    flushList()

    if (trimmed.length === 0) {
      // Blank line → separator, no output.
      continue
    }

    nodes.push(<p key={`p-${nodes.length}`}>{trimmed}</p>)
  }

  // End-of-input flush.
  flushList()

  return nodes.map((node, idx) => <Fragment key={idx}>{node}</Fragment>)
}
