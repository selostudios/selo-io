import { notFound } from 'next/navigation'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { parseHiddenSlides } from '@/lib/reviews/slides/registry'
import { EmptyState } from '@/components/ui/empty-state'
import { ReportEditorHeader } from '@/components/reviews/editor/report-editor-header'
import { StyleMemoButton } from '@/components/reviews/editor/style-memo-button'
import { PreviewButton } from '@/components/reviews/editor/preview-button'
import { SnapshotsButton } from '@/components/reviews/editor/snapshots-button'
import { PublishButton } from '@/components/reviews/editor/publish-button'
import { ContextForAiPanel } from '@/components/reviews/editor/context-for-ai-panel'
import { SlideThumbnailStrip } from '@/components/reviews/editor/slide-thumbnail-strip'

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

  const [{ data: draft }, { data: memoRow }] = await Promise.all([
    supabase
      .from('marketing_review_drafts')
      .select('author_notes, hidden_slides')
      .eq('review_id', id)
      .maybeSingle(),
    supabase
      .from('marketing_review_style_memos')
      .select('memo, updated_at')
      .eq('organization_id', orgId)
      .maybeSingle(),
  ])

  const authorNotes = (draft?.author_notes as string | null) ?? ''
  const styleMemo = (memoRow?.memo as string | null) ?? ''
  const styleMemoUpdatedAt = (memoRow?.updated_at as string | null) ?? null

  const hiddenSlides = parseHiddenSlides(draft?.hidden_slides)

  return (
    <div className="space-y-8 p-8" data-testid="performance-reports-editor">
      <ReportEditorHeader
        backHref={`/${orgId}/reports/performance`}
        title={review.title as string}
        quarter={review.quarter as string}
        actions={
          <>
            <StyleMemoButton orgId={orgId} memo={styleMemo} updatedAt={styleMemoUpdatedAt} />
            <PreviewButton orgId={orgId} reviewId={id} />
            <SnapshotsButton orgId={orgId} reviewId={id} />
            {canEdit && <PublishButton orgId={orgId} reviewId={id} />}
          </>
        }
      />

      {draft ? (
        <>
          <ContextForAiPanel reviewId={id} initialNotes={authorNotes} canEdit={canEdit} />
          <SlideThumbnailStrip orgId={orgId} reviewId={id} hiddenSlides={hiddenSlides} />
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="No draft yet"
          description="Create one from the reports list."
          data-testid="performance-reports-no-draft"
        />
      )}
    </div>
  )
}
