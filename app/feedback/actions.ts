'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FeedbackCategory } from '@/lib/types/feedback'

interface SubmitFeedbackResult {
  success?: boolean
  feedbackId?: string
  error?: string
}

export async function submitFeedback(formData: FormData): Promise<SubmitFeedbackResult> {
  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const category = formData.get('category') as FeedbackCategory
  const pageUrl = formData.get('pageUrl') as string | null
  const userAgent = formData.get('userAgent') as string | null
  const screenshot = formData.get('screenshot') as File | null

  // Validation
  if (!title || title.trim().length < 3) {
    return { error: 'Title must be at least 3 characters' }
  }

  if (!description || description.trim().length < 10) {
    return { error: 'Description must be at least 10 characters' }
  }

  const validCategories: FeedbackCategory[] = [
    'bug',
    'feature_request',
    'performance',
    'usability',
    'other',
  ]
  if (!validCategories.includes(category)) {
    console.error('[Submit Feedback Error]', {
      type: 'invalid_category',
      category,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Invalid category selected' }
  }

  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    console.error('[Submit Feedback Error]', {
      type: 'user_record_not_found',
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { error: 'User record not found' }
  }

  // Upload screenshot if provided
  let screenshotUrl: string | null = null
  if (screenshot && screenshot.size > 0) {
    try {
      const fileExt = screenshot.name.split('.').pop() || 'png'
      const filePath = `${user.id}/${Date.now()}.${fileExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('feedback-screenshots')
        .upload(filePath, screenshot, {
          contentType: screenshot.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('[Submit Feedback Error]', {
          type: 'screenshot_upload_error',
          error: uploadError,
          timestamp: new Date().toISOString(),
        })
        // Don't fail the whole submission for screenshot upload failure
      } else if (uploadData) {
        const {
          data: { publicUrl },
        } = supabase.storage.from('feedback-screenshots').getPublicUrl(uploadData.path)
        screenshotUrl = publicUrl
      }
    } catch (err) {
      console.error('[Submit Feedback Error]', {
        type: 'screenshot_upload_exception',
        error: err,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Insert feedback record
  const { data: feedback, error: insertError } = await supabase
    .from('feedback')
    .insert({
      title: title.trim(),
      description: description.trim(),
      category,
      status: 'new',
      submitted_by: user.id,
      organization_id: userRecord.organization_id,
      page_url: pageUrl || null,
      user_agent: userAgent || null,
      screenshot_url: screenshotUrl,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[Submit Feedback Error]', {
      type: 'database_insert_error',
      error: insertError,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to submit feedback. Please try again.' }
  }

  // Notify developers
  await notifyDevelopers(feedback.id, title, description, category, user.email || 'Unknown user')

  revalidatePath('/support')

  return {
    success: true,
    feedbackId: feedback.id,
  }
}

async function notifyDevelopers(
  feedbackId: string,
  title: string,
  description: string,
  category: FeedbackCategory,
  submitterEmail: string
): Promise<void> {
  const supabase = await createClient()

  // Get all developers
  const { data: developers, error: devError } = await supabase
    .from('users')
    .select('email')
    .eq('role', 'developer')

  if (devError || !developers || developers.length === 0) {
    console.error('[Notify Developers Error]', {
      type: 'no_developers_found',
      error: devError,
      timestamp: new Date().toISOString(),
    })
    return
  }

  const supportUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/support?issue=${feedbackId}`

  try {
    const { sendEmail, FROM_EMAIL } = await import('@/lib/email/client')
    const FeedbackSubmittedEmail = (await import('@/emails/feedback-submitted-email')).default

    // Send email to each developer
    for (const developer of developers) {
      if (!developer.email) continue

      try {
        const result = await sendEmail({
          from: FROM_EMAIL,
          to: developer.email,
          subject: `[Feedback] ${title}`,
          react: FeedbackSubmittedEmail({
            feedbackId,
            title,
            description,
            category,
            submitterEmail,
            supportUrl,
          }),
        })

        if (result.error) {
          console.error('[Notify Developers Error]', {
            type: 'email_send_error',
            developerEmail: developer.email,
            error: result.error,
            timestamp: new Date().toISOString(),
          })
        }
      } catch (emailErr) {
        console.error('[Notify Developers Error]', {
          type: 'email_send_exception',
          developerEmail: developer.email,
          error: emailErr,
          timestamp: new Date().toISOString(),
        })
      }
    }
  } catch (err) {
    console.error('[Notify Developers Error]', {
      type: 'email_import_error',
      error: err,
      timestamp: new Date().toISOString(),
    })
  }
}
