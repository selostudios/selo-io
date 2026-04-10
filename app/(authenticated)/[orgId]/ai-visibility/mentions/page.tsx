import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ai-visibility/page-header'
import { MentionFilters } from '@/components/ai-visibility/mention-filters'
import { MentionsList } from '@/components/ai-visibility/mentions-list'
import { getMentions } from '@/lib/ai-visibility/queries'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ platform?: string; sentiment?: string; days?: string }>
}

export default async function MentionsPage({ params, searchParams }: PageProps) {
  const { orgId } = await params
  const filters = await searchParams
  const supabase = await createClient()

  const mentions = await getMentions(supabase, orgId, {
    platform: filters.platform,
    sentiment: filters.sentiment,
    days: filters.days ? parseInt(filters.days, 10) : 30,
  })

  const hasFilters = !!(filters.platform || filters.sentiment)

  return (
    <div className="flex-1 space-y-6 p-6">
      <PageHeader title="Brand Mentions" />

      <Suspense>
        <MentionFilters />
      </Suspense>

      <MentionsList mentions={mentions} hasFilters={hasFilters} />
    </div>
  )
}
