import { parseBodyNarrative, type NarrativeNode } from './parse-body-narrative'

export const EMPTY_NARRATIVE_PLACEHOLDER = 'No narrative available for this section'

export interface SlideNarrativeProps {
  text: string
  testId: string
}

/**
 * Renders the shared narrative block used by every deck body slide.
 *
 * Empty/whitespace-only `text` renders a muted placeholder; otherwise the text
 * is parsed into paragraphs and bullet lists and mapped to matching JSX with
 * the deck's baseline typography. `testId` is required so each slide type can
 * identify its own content region in tests (avoids ambiguous selectors when
 * two slide types render in the same tree).
 */
export function SlideNarrative({ text, testId }: SlideNarrativeProps) {
  if (text.trim().length === 0) {
    return (
      <p className="text-muted-foreground text-base italic md:text-lg">
        {EMPTY_NARRATIVE_PLACEHOLDER}
      </p>
    )
  }

  return (
    <div
      data-testid={testId}
      className="text-foreground max-w-3xl space-y-4 text-base leading-relaxed md:text-lg lg:text-xl"
    >
      {parseBodyNarrative(text).map((node: NarrativeNode, idx) => {
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
      })}
    </div>
  )
}
