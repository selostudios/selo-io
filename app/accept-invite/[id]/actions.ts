'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function acceptInvite(inviteId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Get the invite
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('*')
    .eq('id', inviteId)
    .single()

  if (inviteError || !invite) {
    return { error: 'Invite not found' }
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    console.error('[Accept Invite Error]', { type: 'expired', inviteId, timestamp: new Date().toISOString() })
    return { error: 'This invite has expired' }
  }

  // Check if status is not pending (could be accepted or expired)
  if (invite.status !== 'pending') {
    console.error('[Accept Invite Error]', { type: 'already_used', inviteId, status: invite.status, timestamp: new Date().toISOString() })
    return { error: 'This invite has already been used' }
  }

  // Validate email matches
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    console.error('[Accept Invite Error]', { type: 'email_mismatch', inviteId, timestamp: new Date().toISOString() })
    return { error: 'This invite was sent to a different email address' }
  }

  // Check if user already has an organization
  const { data: existingUser } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (existingUser?.organization_id) {
    console.error('[Accept Invite Error]', { type: 'already_has_org', inviteId, userId: user.id, timestamp: new Date().toISOString() })
    return { error: 'You already belong to an organization' }
  }

  // Use upsert for user record (safer than insert)
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      organization_id: invite.organization_id,
      role: invite.role,
    }, {
      onConflict: 'id'
    })

  if (userError) {
    console.error('[Accept Invite Error]', { type: 'user_record_creation', error: userError.message, timestamp: new Date().toISOString() })
    return { error: 'Failed to join organization. Please try again.' }
  }

  // Mark invite as accepted - only update if still pending (prevents race condition)
  const { error: updateError } = await supabase
    .from('invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('id', inviteId)
    .eq('status', 'pending') // Critical: only update if status is still pending

  if (updateError) {
    // If update failed, it might be because another request already accepted it
    console.error('[Accept Invite Error]', { type: 'invite_update_failed', error: updateError.message, timestamp: new Date().toISOString() })

    // Check if invite was accepted by another process
    const { data: checkInvite } = await supabase
      .from('invites')
      .select('status')
      .eq('id', inviteId)
      .single()

    if (checkInvite?.status === 'accepted') {
      return { error: 'This invite has already been accepted' }
    }

    return { error: 'Failed to accept invite. Please try again.' }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
