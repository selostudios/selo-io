import { SlideLayout } from './slide-layout'
import { EMPTY_NARRATIVE_PLACEHOLDER } from './slide-narrative'

export { EMPTY_NARRATIVE_PLACEHOLDER }

export interface BodySlideProps {
  heading: string
  text: string
}

/**
 * Plain heading + narrative slide (initiatives, takeaways, planning). Sibling
 * slides that add a body slot wire `<SlideLayout>` directly.
 */
export function BodySlide({ heading, text }: BodySlideProps) {
  return <SlideLayout heading={heading} narrative={text} narrativeTestId="body-slide-content" />
}
