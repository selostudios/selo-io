import { TopPostGrid } from './top-post-grid'
import { SlideLayout } from './slide-layout'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface ContentBodySlideProps {
  narrative: string
  posts: LinkedInTopPost[]
  // TODO: use `mode` for print-specific styling (see linkedin-body-slide.tsx).
  // Kept in the prop contract now so callers match the sibling slides.
  mode: 'screen' | 'print'
}

export function ContentBodySlide({ narrative, posts }: ContentBodySlideProps) {
  return (
    <SlideLayout
      heading="What Resonated"
      body={<TopPostGrid posts={posts} />}
      narrative={narrative}
      narrativeTestId="content-body-slide-content"
    />
  )
}
