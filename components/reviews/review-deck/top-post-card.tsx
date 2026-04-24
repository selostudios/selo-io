'use client'

import { useState } from 'react'
import { TextPostPlaceholder } from './text-post-placeholder'
import type { LinkedInTopPost } from '@/lib/reviews/types'

export interface TopPostCardProps {
  post: LinkedInTopPost
}

export function TopPostCard({ post }: TopPostCardProps) {
  const [broken, setBroken] = useState(false)
  const totalEngagements = post.reactions + post.comments + post.shares
  return (
    <div data-testid="top-post-card" className="flex w-full max-w-[240px] flex-col gap-3">
      <div className="overflow-hidden rounded-md">
        {post.thumbnail_url && !broken ? (
          <img
            src={post.thumbnail_url}
            alt={post.caption ?? 'LinkedIn post thumbnail'}
            className="aspect-[4/3] w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <TextPostPlaceholder />
        )}
      </div>
      <p className="line-clamp-2 text-sm text-foreground/90">{post.caption ?? ''}</p>
      <div
        className="text-3xl font-semibold tabular-nums"
        style={{ color: 'var(--deck-accent)' }}
      >
        {(post.engagement_rate * 100).toFixed(1)}%
      </div>
      <div className="text-xs tabular-nums text-foreground/60">
        {post.impressions.toLocaleString()} · {totalEngagements.toLocaleString()}
      </div>
    </div>
  )
}
