import { TopPostCard } from './top-post-card'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface TopPostGridProps {
  posts: LinkedInTopPost[]
}

export function TopPostGrid({ posts }: TopPostGridProps) {
  if (posts.length === 0) return null
  const columnCount = Math.min(posts.length, 4)
  return (
    <div
      data-testid="top-post-grid"
      className="mx-auto grid w-full justify-center gap-4 md:gap-6"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        maxWidth: posts.length < 4 ? `${posts.length * 280}px` : undefined,
      }}
    >
      {posts.map((post) => (
        <TopPostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
