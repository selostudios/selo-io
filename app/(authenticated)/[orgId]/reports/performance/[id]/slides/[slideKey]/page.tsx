import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import {
  isSlideKey,
  parseHiddenSlides,
  SLIDES,
  getSlide,
  type SlideDefinition,
} from '@/lib/reviews/slides/registry'
import { formatQuarterLabel, periodsForQuarter } from '@/lib/reviews/period'
import type { NarrativeBlocks, SnapshotData } from '@/lib/reviews/types'
import { ReportEditorHeader } from '@/components/reviews/editor/report-editor-header'
import { StyleMemoButton } from '@/components/reviews/editor/style-memo-button'
import { PreviewButton } from '@/components/reviews/editor/preview-button'
import { SnapshotsButton } from '@/components/reviews/editor/snapshots-button'
import { PublishButton } from '@/components/reviews/editor/publish-button'
import { HideSlideToggle } from '@/components/reviews/editor/hide-slide-toggle'
import { SlideTray } from '@/components/reviews/editor/slide-tray'
import { SlideStage } from '@/components/reviews/editor/slide-stage'
import { CoverTrayEditor } from '@/components/reviews/editor/trays/cover-tray-editor'
import { GaTrayEditor } from '@/components/reviews/editor/trays/ga-tray-editor'
import { LinkedInTrayEditor } from '@/components/reviews/editor/trays/linkedin-tray-editor'
import { ContentTrayEditor } from '@/components/reviews/editor/trays/content-tray-editor'
import { ProseTrayEditor } from '@/components/reviews/editor/trays/prose-tray-editor'

export const dynamic = 'force-dynamic'

function trayContent(
  slide: SlideDefinition,
  reviewId: string,
  narrative: NarrativeBlocks,
  disabled: boolean
) {
  const initialValue = (narrative[slide.narrativeBlockKey] as string | undefined) ?? ''
  switch (slide.kind) {
    case 'cover':
      return <CoverTrayEditor reviewId={reviewId} initialValue={initialValue} disabled={disabled} />
    case 'ga':
      return <GaTrayEditor reviewId={reviewId} initialValue={initialValue} disabled={disabled} />
    case 'linkedin':
      return (
        <LinkedInTrayEditor reviewId={reviewId} initialValue={initialValue} disabled={disabled} />
      )
    case 'content':
      return (
        <ContentTrayEditor reviewId={reviewId} initialValue={initialValue} disabled={disabled} />
      )
    case 'prose':
      // `slide.kind === 'prose'` only matches initiatives, takeaways, and
      // planning per the registry — the cast is safe.
      return (
        <ProseTrayEditor
          reviewId={reviewId}
          slideKey={slide.key as 'initiatives' | 'takeaways' | 'planning'}
          initialValue={initialValue}
          disabled={disabled}
        />
      )
  }
}

export default async function PerformanceReportSlideEditorPage({
  params,
}: {
  params: Promise<{ orgId: string; id: string; slideKey: string }>
}) {
  const { orgId, id, slideKey } = await params

  if (!isSlideKey(slideKey)) notFound()
  const slide = getSlide(slideKey)
  const slideIndex = SLIDES.findIndex((s) => s.key === slide.key)

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

  const [{ data: draft }, { data: org }, { data: memoRow }] = await Promise.all([
    supabase
      .from('marketing_review_drafts')
      .select('narrative, data, author_notes, hidden_slides')
      .eq('review_id', id)
      .maybeSingle(),
    supabase
      .from('organizations')
      .select('name, logo_url, primary_color')
      .eq('id', orgId)
      .maybeSingle(),
    supabase
      .from('marketing_review_style_memos')
      .select('memo, updated_at')
      .eq('organization_id', orgId)
      .maybeSingle(),
  ])

  if (!draft) notFound()

  const narrative = (draft.narrative as NarrativeBlocks | null) ?? {}
  const data = (draft.data as SnapshotData | null) ?? {}
  const hiddenSlides = parseHiddenSlides(draft.hidden_slides)

  const styleMemo = (memoRow?.memo as string | null) ?? ''
  const styleMemoUpdatedAt = (memoRow?.updated_at as string | null) ?? null

  const quarterLabel = formatQuarterLabel(review.quarter as string)
  const periods = periodsForQuarter(review.quarter as string)

  return (
    <div className="flex h-screen flex-col" data-testid="performance-reports-slide-editor">
      <ReportEditorHeader
        backHref={`/${orgId}/reports/performance/${id}`}
        title={slide.label}
        quarter={`Slide ${slideIndex + 1} of ${SLIDES.length}`}
        actions={
          <>
            <HideSlideToggle
              reviewId={id}
              slideKey={slide.key}
              hidden={hiddenSlides.includes(slide.key)}
              hideable={slide.hideable}
            />
            <StyleMemoButton orgId={orgId} memo={styleMemo} updatedAt={styleMemoUpdatedAt} />
            <PreviewButton orgId={orgId} reviewId={id} />
            <SnapshotsButton orgId={orgId} reviewId={id} />
            {canEdit && <PublishButton orgId={orgId} reviewId={id} />}
          </>
        }
      />

      {/* pb-32 keeps the deck clear of the fixed bottom tray. */}
      <main className="flex-1 overflow-auto p-8 pb-32">
        <SlideStage
          slideKey={slide.key}
          organization={{
            name: (org?.name as string | undefined) ?? 'Organization',
            logo_url: (org?.logo_url as string | null | undefined) ?? null,
            primary_color: (org?.primary_color as string | null | undefined) ?? null,
          }}
          quarter={quarterLabel}
          periodStart={periods.main.start}
          periodEnd={periods.main.end}
          narrative={narrative}
          data={data}
          hiddenSlides={hiddenSlides}
        />
      </main>

      <SlideTray defaultExpanded>{trayContent(slide, id, narrative, !canEdit)}</SlideTray>
    </div>
  )
}
