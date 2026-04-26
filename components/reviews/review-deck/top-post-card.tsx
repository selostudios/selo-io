'use client'

import Image from 'next/image'
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
          <Image
            src={post.thumbnail_url}
            alt={post.caption ?? 'LinkedIn post thumbnail'}
            width={240}
            height={135}
            sizes="240px"
            className="aspect-[16/9] w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <TextPostPlaceholder />
        )}
      </div>
      <p className="text-foreground line-clamp-2 text-sm font-semibold">{post.caption ?? ''}</p>
      <div>
        <div
          className="text-3xl font-semibold tabular-nums"
          style={{ color: 'var(--deck-accent)' }}
        >
          {(post.engagement_rate * 100).toFixed(1)}%
        </div>
        <p className="text-muted-foreground text-xs">Engagement rate per post</p>
      </div>
      <dl className="text-foreground/70 grid grid-cols-2 gap-2 text-xs tabular-nums">
        <div>
          <dt className="text-muted-foreground">Impressions</dt>
          <dd className="font-medium">{post.impressions.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Engagements</dt>
          <dd className="font-medium">{totalEngagements.toLocaleString()}</dd>
        </div>
      </dl>
    </div>
  )
}
