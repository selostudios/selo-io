import { TopPostCard } from './top-post-card'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface TopPostGridProps {
  posts: LinkedInTopPost[]
}

export function TopPostGrid({ posts }: TopPostGridProps) {
  if (posts.length === 0) return null
  return (
    <div
      data-testid="top-post-grid"
      className="flex w-full flex-wrap justify-center gap-6"
    >
      {posts.map((post) => (
        <TopPostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
