import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, getUserRecord } from '@/lib/auth/cached'
import { isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import type { NarrativeBlocks } from '@/lib/reviews/types'
import { AuthorNotesEditor } from './author-notes-editor'
import { EditorHeader } from './editor-header'
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
    .select('narrative, ai_originals, author_notes')
    .eq('review_id', id)
    .maybeSingle()

  const narrative = (draft?.narrative as NarrativeBlocks | null) ?? {}
  const aiOriginals = (draft?.ai_originals as NarrativeBlocks | null) ?? {}
  const authorNotes = (draft?.author_notes as string | null) ?? ''

  return (
    <div className="mx-auto max-w-3xl p-8" data-testid="performance-reports-editor">
      <EditorHeader
        orgId={orgId}
        reviewId={id}
        title={review.title as string}
        quarter={review.quarter as string}
        canEdit={canEdit}
      />

      {draft ? (
        <div className="space-y-8">
          <AuthorNotesEditor reviewId={id} initialNotes={authorNotes} canEdit={canEdit} />
          <NarrativeEditor
            reviewId={id}
            narrative={narrative}
            aiOriginals={aiOriginals}
            canEdit={canEdit}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm" data-testid="performance-reports-no-draft">
          No draft yet. Create one from the reports list.
        </p>
      )}
    </div>
  )
}
