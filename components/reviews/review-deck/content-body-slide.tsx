import { TopPostGrid } from './top-post-grid'
import { SlideNarrative } from './slide-narrative'
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
    <div className="flex h-full w-full flex-col justify-center gap-6 px-8 py-12 md:px-16 lg:px-24">
      <h2
        className="text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl"
        style={{ color: 'var(--deck-accent)' }}
      >
        What Resonated
      </h2>
      <TopPostGrid posts={posts} />
      <SlideNarrative text={narrative} testId="content-body-slide-content" />
    </div>
  )
}
