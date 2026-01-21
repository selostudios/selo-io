'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FeedbackStatus, FeedbackPriority } from '@/lib/types/feedback'
import { canManageFeedback } from '@/lib/permissions'

interface UpdateFeedbackStatusParams {
  feedbackId: string
  status: FeedbackStatus
  priority: FeedbackPriority | null
  note: string | null
}

export async function updateFeedbackStatus({
  feedbackId,
  status,
  priority,
  note,
}: UpdateFeedbackStatusParams) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Verify user is a developer
  const { data: userRecord } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageFeedback(userRecord.role)) {
    return { error: 'Only developers can update feedback' }
  }

  // Get the current feedback to check for status changes
  const { data: currentFeedback } = await supabase
    .from('feedback')
    .select('status')
    .eq('id', feedbackId)
    .single()

  if (!currentFeedback) {
    return { error: 'Feedback not found' }
  }

  const previousStatus = currentFeedback.status as FeedbackStatus

  // Update the feedback
  const { error } = await supabase
    .from('feedback')
    .update({
      status,
      priority,
      status_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedbackId)

  if (error) {
    console.error('[Feedback Update Error]', {
      type: 'database_error',
      error,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to update feedback' }
  }

  // If status changed, notify the submitter
  if (status !== previousStatus) {
    try {
      await notifySubmitter(feedbackId, previousStatus, status, note)
    } catch (emailError) {
      console.error('[Feedback Status Email Error]', {
        type: 'email_error',
        error: emailError,
        timestamp: new Date().toISOString(),
      })
      // Don't fail the update if email fails
    }
  }

  revalidatePath('/support')

  return { success: true }
}

async function notifySubmitter(
  feedbackId: string,
  oldStatus: FeedbackStatus,
  newStatus: FeedbackStatus,
  note: string | null
) {
  const supabase = await createClient()

  // Get feedback with submitter info
  const { data: feedback } = await supabase
    .from('feedback')
    .select('title, submitted_by')
    .eq('id', feedbackId)
    .single()

  if (!feedback) return

  // Get submitter's email
  const { data: authUser } = await supabase.auth.admin.getUserById(feedback.submitted_by)
  if (!authUser?.user?.email) return

  const { sendEmail, FROM_EMAIL } = await import('@/lib/email/client')
  const FeedbackStatusEmail = (await import('@/emails/feedback-status-email')).default

  await sendEmail({
    from: FROM_EMAIL,
    to: authUser.user.email,
    subject: `[Selo] Your issue has been updated: ${feedback.title}`,
    react: FeedbackStatusEmail({
      title: feedback.title,
      oldStatus,
      newStatus,
      note,
    }),
  })
}
