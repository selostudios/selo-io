import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { Button } from '@/components/ui/button'
import { loadPromptOverrides } from '@/lib/reviews/narrative/overrides'
import { defaultTemplates, NARRATIVE_BLOCK_KEYS } from '@/lib/reviews/narrative/prompts'
import { createClient } from '@/lib/supabase/server'
import { PromptsForm, type PromptBlockView } from './prompts-form'
import { StyleMemoCard } from './style-memo-card'
import { StyleMemoHistoryTimeline } from './style-memo-history-timeline'

export const dynamic = 'force-dynamic'

const BLOCK_LABELS: Record<(typeof NARRATIVE_BLOCK_KEYS)[number], { label: string; hint: string }> =
  {
    cover_subtitle: {
      label: 'Cover subtitle',
      hint: 'One-liner capturing the quarter’s headline story (≤ 20 words).',
    },
    ga_summary: {
      label: 'Google Analytics summary',
      hint: 'Narrative over sessions, users, and engagement (≤ 120 words).',
    },
    linkedin_insights: {
      label: 'LinkedIn insights',
      hint: 'Follower growth, impression trends, top post themes (≤ 120 words).',
    },
    initiatives: {
      label: 'Initiatives',
      hint: 'What the team shipped or focused on this quarter (≤ 150 words).',
    },
    takeaways: {
      label: 'Takeaways',
      hint: 'Two or three key lessons from the data (≤ 150 words).',
    },
    planning: {
      label: 'Planning ahead',
      hint: 'Forward-looking, opportunity-framed recommendations (≤ 150 words).',
    },
  }

export default async function PerformanceReportSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params

  const user = await getAuthUser()
  const userRecord = user ? await getUserRecord(user.id) : null
  if (!userRecord) redirect(`/${orgId}/reports/performance`)
  const canManage = isInternalUser(userRecord) || userRecord.role === UserRole.Admin
  if (!canManage) redirect(`/${orgId}/reports/performance`)

  const supabase = await createClient()

  const [overrides, memoResult] = await Promise.all([
    loadPromptOverrides(orgId),
    supabase
      .from('marketing_review_style_memos')
      .select('memo, source, updated_at, updated_by')
      .eq('organization_id', orgId)
      .maybeSingle(),
  ])

  const memoRow = memoResult.data as {
    memo: string
    source: 'auto' | 'manual'
    updated_at: string
    updated_by: string | null
  } | null

  let updatedByName: string | null = null
  if (memoRow?.updated_by) {
    const { data: updater } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', memoRow.updated_by)
      .maybeSingle()
    const u = updater as { first_name: string | null; last_name: string | null } | null
    const first = (u?.first_name ?? '').trim()
    const last = (u?.last_name ?? '').trim()
    const full = `${first} ${last}`.trim()
    updatedByName = full.length > 0 ? full : null
  }

  const blocks: PromptBlockView[] = NARRATIVE_BLOCK_KEYS.map((key) => ({
    key,
    label: BLOCK_LABELS[key].label,
    hint: BLOCK_LABELS[key].hint,
    defaultTemplate: defaultTemplates[key](),
    override: overrides[key] ?? '',
  }))

  return (
    <div className="mx-auto max-w-3xl p-8" data-testid="performance-reports-settings">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Narrative prompt settings</h1>
          <p className="text-muted-foreground text-sm">
            Tailor the prompts used to generate each section of your quarterly performance report.
            Leave a block blank to use the default.
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={`/${orgId}/reports/performance`}>Back</Link>
        </Button>
      </div>

      <StyleMemoCard
        orgId={orgId}
        memo={memoRow?.memo ?? ''}
        source={memoRow?.source ?? 'auto'}
        updatedAt={memoRow?.updated_at ?? null}
        updatedByName={updatedByName}
      />

      <StyleMemoHistoryTimeline orgId={orgId} />

      <PromptsForm orgId={orgId} blocks={blocks} />
    </div>
  )
}
