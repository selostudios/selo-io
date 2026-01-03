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

  // Check if invite is already accepted
  if (invite.accepted_at) {
    return { error: 'This invite has already been used' }
  }

  // Check if invite is expired
  const expiresAt = new Date(invite.expires_at)
  if (expiresAt < new Date()) {
    return { error: 'This invite has expired' }
  }

  // Check if email matches
  if (user.email !== invite.email) {
    return { error: 'This invite was sent to a different email address' }
  }

  // Check if user already has an organization
  const { data: existingUser } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (existingUser?.organization_id) {
    return { error: 'You are already part of an organization' }
  }

  // Create user record with organization
  const { error: userError } = await supabase
    .from('users')
    .upsert({
      id: user.id,
      organization_id: invite.organization_id,
      role: invite.role,
    })

  if (userError) {
    return { error: userError.message }
  }

  // Mark invite as accepted
  const { error: updateError } = await supabase
    .from('invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inviteId)

  if (updateError) {
    return { error: updateError.message }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
