import { SlideNarrative, EMPTY_NARRATIVE_PLACEHOLDER } from './slide-narrative'

export { EMPTY_NARRATIVE_PLACEHOLDER }

export interface BodySlideProps {
  heading: string
  text: string
}

/**
 * Renders a deck body slide: a heading + a narrative block.
 *
 * Narrative parsing and rendering live in `<SlideNarrative>` so GA's body slide
 * (which adds a metric strip between heading and narrative) can reuse the same
 * typography without duplicating the parser / renderer / placeholder.
 */
export function BodySlide({ heading, text }: BodySlideProps) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-8 py-12 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        {heading}
      </h2>

      <SlideNarrative text={text} testId="body-slide-content" />
    </div>
  )
}
