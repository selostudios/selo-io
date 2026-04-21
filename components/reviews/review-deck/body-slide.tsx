import { parseBodyNarrative, type NarrativeNode } from './parse-body-narrative'

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
 * Turns parsed narrative nodes into React elements with the BodySlide styling.
 *
 * Rendering lives here (not in the parser) because styling is owned by the
 * slide. The parser returns a shared AST; each slide maps that AST to its own
 * markup.
 */
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
