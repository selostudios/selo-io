/**
 * A node in the parsed narrative AST.
 *
 * - `paragraph` wraps a single line of text.
 * - `list` collects one or more consecutive bullet items (lines starting with
 *   `- `) into a single list.
 */
export type NarrativeNode =
  | { kind: 'paragraph'; content: string }
  | { kind: 'list'; content: string[] }

/**
 * Parses plain-text narrative into a list of typed nodes.
 *
 * Rules:
 * - Lines starting with `- ` (after trimming leading whitespace) are treated
 *   as list items. Consecutive bullet lines collapse into a single list node.
 * - Blank / whitespace-only lines act as separators and produce no output.
 * - Any other non-blank line becomes its own paragraph node.
 *
 * The function is pure and React-agnostic so it can be reused by any slide
 * that wants to render this narrative shape.
 */
export function parseBodyNarrative(text: string): NarrativeNode[] {
  const lines = text.split('\n')
  const nodes: NarrativeNode[] = []

  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    nodes.push({ kind: 'list', content: listBuffer.slice() })
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

    nodes.push({ kind: 'paragraph', content: trimmed })
  }

  // End-of-input flush.
  flushList()

  return nodes
}
