'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendInvite(formData: FormData) {
  const email = formData.get('email') as string
  const role = formData.get('role') as 'admin' | 'team_member' | 'client_viewer'

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
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

  // Get organization name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', userRecord.organization_id)
    .single()

  // Send email using Resend
  try {
    const { resend, FROM_EMAIL } = await import('@/lib/email/client')
    const InviteEmail = (await import('@/emails/invite-email')).default

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You've been invited to join ${org?.name || 'an organization'} on Selo IO`,
      react: InviteEmail({
        inviteLink,
        organizationName: org?.name || 'the organization',
        invitedByEmail: user.email!,
        role,
      }),
    })
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError)
    // Don't fail the invite creation if email fails
  }

  revalidatePath('/dashboard/settings/team')

  return {
    success: true,
    inviteLink,
    message: `Invite sent to ${email}!`
  }
}

export async function deleteInvite(inviteId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/settings/team')
  return { success: true }
}
