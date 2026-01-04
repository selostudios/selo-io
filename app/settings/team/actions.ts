'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendInvite(formData: FormData) {
  const email = formData.get('email') as string
  const role = formData.get('role') as 'admin' | 'team_member' | 'client_viewer'

  // Input validation
  if (!email || !email.trim()) {
    return { error: 'Email address is required' }
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { error: 'Invalid email address format' }
  }

  // Validate role
  const validRoles: Array<'admin' | 'team_member' | 'client_viewer'> = [
    'admin',
    'team_member',
    'client_viewer',
  ]
  if (!validRoles.includes(role)) {
    console.error('[Send Invite Error]', {
      type: 'invalid_role',
      role,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Invalid role selected' }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can send invites' }
  }

  // Create invite
  const { data: invite, error } = await supabase
    .from('invites')
    .insert({
      email,
      organization_id: userRecord.organization_id,
      role,
      invited_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  // Send invite email
  const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite/${invite.id}`

  // Get organization name and logo
  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url')
    .eq('id', userRecord.organization_id)
    .single()

  // Send email using Resend
  let emailSent = false
  let emailError: string | null = null

  try {
    const { sendEmail, FROM_EMAIL } = await import('@/lib/email/client')
    const InviteEmail = (await import('@/emails/invite-email')).default

    console.log('[Email Debug] Sending invite email to:', email)
    console.log('[Email Debug] From:', FROM_EMAIL)

    const result = await sendEmail({
      from: FROM_EMAIL,
      to: email,
      subject: `You've been invited to join ${org?.name || 'an organization'} on Selo IO`,
      react: InviteEmail({
        inviteLink,
        organizationName: org?.name || 'the organization',
        invitedByEmail: user.email!,
        role,
        logoUrl: org?.logo_url || null,
      }),
    })

    console.log('[Email Debug] Result:', JSON.stringify(result, null, 2))

    if (result.error) {
      console.error('Email API error:', result.error)
      emailError = result.error.message
    } else if (result.data?.id) {
      console.log('[Email Debug] Email sent successfully, ID:', result.data.id)
      emailSent = true
    } else {
      console.error('[Email Debug] No error but no ID returned')
      emailError = 'Email service returned unexpected response'
    }
  } catch (err) {
    console.error('Failed to send invite email:', err)
    emailError = err instanceof Error ? err.message : 'Unknown error sending email'
  }

  revalidatePath('/settings/team')

  if (!emailSent) {
    return {
      success: true,
      inviteLink,
      warning: `Invite created but email failed to send: ${emailError}. Share this link manually: ${inviteLink}`,
    }
  }

  return {
    success: true,
    inviteLink,
    message: `Invite sent to ${email}!`,
  }
}

export async function resendInvite(inviteId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    return { error: 'Only admins can resend invites' }
  }

  // Get the invite
  const { data: invite } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (!invite) {
    return { error: 'Invite not found' }
  }

  // Update expires_at to extend the invite
  const newExpiresAt = new Date()
  newExpiresAt.setDate(newExpiresAt.getDate() + 7)

  const { error: updateError } = await supabase
    .from('invites')
    .update({ expires_at: newExpiresAt.toISOString() })
    .eq('id', inviteId)

  if (updateError) {
    console.error('[Resend Invite Error]', {
      type: 'update_error',
      error: updateError,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to update invite expiration' }
  }

  // Get organization name and logo
  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url')
    .eq('id', userRecord.organization_id)
    .single()

  // Send invite email
  const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite/${invite.id}`

  try {
    const { sendEmail, FROM_EMAIL } = await import('@/lib/email/client')
    const InviteEmail = (await import('@/emails/invite-email')).default

    const result = await sendEmail({
      from: FROM_EMAIL,
      to: invite.email,
      subject: `Reminder: You've been invited to join ${org?.name || 'an organization'} on Selo IO`,
      react: InviteEmail({
        inviteLink,
        organizationName: org?.name || 'the organization',
        invitedByEmail: user.email!,
        role: invite.role,
        logoUrl: org?.logo_url || null,
      }),
    })

    if (result.error) {
      console.error('Failed to send invite email:', result.error)
      return { error: 'Failed to send invite email' }
    }
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError)
    return { error: 'Failed to send invite email' }
  }

  revalidatePath('/settings/team')

  return {
    success: true,
    message: `Invite resent to ${invite.email}!`,
  }
}

export async function deleteInvite(inviteId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get user's organization and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord || userRecord.role !== 'admin') {
    console.error('[Delete Invite Error]', {
      type: 'unauthorized',
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Only admins can delete invites' }
  }

  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId)
    .eq('organization_id', userRecord.organization_id) // Ensure invite belongs to user's org

  if (error) {
    console.error('[Delete Invite Error]', {
      type: 'database_error',
      timestamp: new Date().toISOString(),
    })
    return { error: 'Failed to delete invite. Please try again.' }
  }

  revalidatePath('/settings/team')
  return { success: true }
}
