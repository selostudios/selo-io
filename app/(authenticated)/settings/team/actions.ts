'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { canManageTeam, isInternalUser } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { resolveOrganizationId } from '@/lib/auth/resolve-org'

export async function sendInvite(formData: FormData) {
  const email = formData.get('email') as string
  const role = formData.get('role') as UserRole
  const targetOrgId = formData.get('organizationId') as string | null

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
  const validRoles: UserRole[] = [
    UserRole.Admin,
    UserRole.TeamMember,
    UserRole.ClientViewer,
    UserRole.ExternalDeveloper,
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

  // Get user's record
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageTeam(userRecord.role)) {
    return { error: 'Only admins can send invites' }
  }

  // Resolve the target organization: use explicit ID if provided, otherwise resolve from cookie/user
  const isInternal = isInternalUser(userRecord)
  const organizationId = targetOrgId
    || await resolveOrganizationId(undefined, userRecord.organization_id, isInternal)

  if (!organizationId) {
    return { error: 'No organization selected' }
  }

  // Check if there's an existing accepted invite for this email
  const { data: existingInvite } = await supabase
    .from('invites')
    .select('status')
    .eq('email', email.toLowerCase())
    .single()

  if (existingInvite?.status === 'accepted') {
    return { error: 'This email has already accepted an invite' }
  }

  // Calculate new expiry (7 days from now)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Use service client for internal users inviting to orgs they don't belong to
  const insertClient = isInternal ? createServiceClient() : supabase

  // Upsert invite - create new or update existing (extends expiry)
  const { data: invite, error } = await insertClient
    .from('invites')
    .upsert(
      {
        email: email.toLowerCase(),
        organization_id: organizationId,
        role,
        invited_by: user.id,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: 'email',
      }
    )
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
    .eq('id', organizationId)
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

  // Get user's record
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageTeam(userRecord.role)) {
    return { error: 'Only admins can resend invites' }
  }

  const isInternal = isInternalUser(userRecord)

  // Get the invite — internal users can access any org's invites
  const query = isInternal
    ? supabase.from('invites').select('*').eq('id', inviteId)
    : supabase.from('invites').select('*').eq('id', inviteId).eq('organization_id', userRecord.organization_id)

  const { data: invite } = await query.single()

  if (!invite) {
    return { error: 'Invite not found' }
  }

  // Use service client for internal users to bypass RLS
  const updateClient = isInternal ? createServiceClient() : supabase

  // Update expires_at to extend the invite
  const newExpiresAt = new Date()
  newExpiresAt.setDate(newExpiresAt.getDate() + 7)

  const { error: updateError } = await updateClient
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

  // Get organization name and logo from the invite's org
  const { data: org } = await supabase
    .from('organizations')
    .select('name, logo_url')
    .eq('id', invite.organization_id)
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

  // Get user's record
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role, is_internal')
    .eq('id', user.id)
    .single()

  if (!userRecord || !canManageTeam(userRecord.role)) {
    console.error('[Delete Invite Error]', {
      type: 'unauthorized',
      userId: user.id,
      timestamp: new Date().toISOString(),
    })
    return { error: 'Only admins can delete invites' }
  }

  const isInternal = isInternalUser(userRecord)
  const deleteClient = isInternal ? createServiceClient() : supabase

  // Internal users can delete any org's invites; external users scoped to their org
  const query = isInternal
    ? deleteClient.from('invites').delete().eq('id', inviteId)
    : deleteClient.from('invites').delete().eq('id', inviteId).eq('organization_id', userRecord.organization_id)

  const { error } = await query

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
