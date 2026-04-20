import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { Button } from '@/components/ui/button'
import type { NarrativeBlocks } from '@/lib/reviews/types'
import { NarrativeEditor } from './narrative-editor'

export const dynamic = 'force-dynamic'

export default async function PerformanceReportEditorPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string }>
}) {
  const { orgId, id } = await params

  const user = await getAuthUser()
  const userRecord = user ? await getUserRecord(user.id) : null
  const canEdit = !!userRecord && (isInternalUser(userRecord) || userRecord.role === UserRole.Admin)

  const supabase = await createClient()
  const { data: review } = await supabase
    .from('marketing_reviews')
    .select('id, title, quarter, organization_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!review) notFound()

  const { data: draft } = await supabase
    .from('marketing_review_drafts')
    .select('narrative, ai_originals')
    .eq('review_id', id)
    .maybeSingle()

  const narrative = (draft?.narrative as NarrativeBlocks | null) ?? {}
  const aiOriginals = (draft?.ai_originals as NarrativeBlocks | null) ?? {}

  return (
    <div className="mx-auto max-w-3xl p-8" data-testid="performance-reports-editor">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{review.title as string}</h1>
          <p className="text-muted-foreground text-sm">{review.quarter as string}</p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={`/${orgId}/reports/performance`}>Back</Link>
        </Button>
      </div>

      {draft ? (
        <NarrativeEditor
          reviewId={id}
          narrative={narrative}
          aiOriginals={aiOriginals}
          canEdit={canEdit}
        />
      ) : (
        <p className="text-muted-foreground text-sm" data-testid="performance-reports-no-draft">
          No draft yet. Create one from the reports list.
        </p>
      )}
    </div>
  )
}
