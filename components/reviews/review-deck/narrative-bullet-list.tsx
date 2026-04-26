interface NarrativeBulletListProps {
  items: string[]
}

/**
 * Shared bullet list for deck narrative blocks. Renders an explicit accent-coloured
 * disc marker per item rather than relying on `list-style: disc`, which is hard to
 * size/colour predictably across slide types and zoom levels.
 */
export function NarrativeBulletList({ items }: NarrativeBulletListProps) {
  return (
    <ul className="space-y-2" data-testid="narrative-bullet-list">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-[0.65em] inline-block size-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: 'var(--deck-accent)' }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
