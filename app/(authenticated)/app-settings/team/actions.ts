'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireInternalUser } from '@/lib/app-settings/auth'

interface InternalEmployee {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  lastSignIn: string | null
  createdAt: string
}

export async function getInternalEmployees(): Promise<InternalEmployee[] | { error: string }> {
  const { error, supabase } = await requireInternalUser()
  if (error) return { error }

  const { data: employees, error: fetchError } = await supabase!
    .from('internal_employees')
    .select('id, user_id, added_by, created_at, users(first_name, last_name)')
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('[App Settings Error]', {
      type: 'fetch_employees',
      timestamp: new Date().toISOString(),
      error: fetchError.message,
    })
    return { error: 'Failed to load employees' }
  }

  // Fetch emails and last sign-in from auth admin API
  const serviceClient = createServiceClient()
  const authResults = await Promise.all(
    (employees ?? []).map((emp) => serviceClient.auth.admin.getUserById(emp.user_id))
  )
  const results: InternalEmployee[] = (employees ?? []).map((emp, i) => {
    const authUser = authResults[i].data
    const noName = { first_name: null, last_name: null }
    const usersRaw = emp.users as unknown as
      | { first_name: string | null; last_name: string | null }
      | { first_name: string | null; last_name: string | null }[]
      | null
    const user = Array.isArray(usersRaw) ? (usersRaw[0] ?? noName) : (usersRaw ?? noName)
    return {
      id: emp.id,
      userId: emp.user_id,
      email: authUser?.user?.email ?? 'unknown',
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      lastSignIn: authUser?.user?.last_sign_in_at ?? null,
      createdAt: emp.created_at,
    }
  })

  return results
}

export async function inviteInternalEmployee(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const { error, user, userRecord } = await requireInternalUser()
  if (error) return { success: false, error }
  if (userRecord!.role !== 'admin') return { success: false, error: 'Admin access required' }

  const serviceClient = createServiceClient()

  // Check if already an internal employee and for existing pending invite in parallel
  const [{ data: existingUser }, { data: existingInvite }] = await Promise.all([
    serviceClient.from('users').select('id, is_internal').ilike('email', email).single(),
    serviceClient
      .from('invites')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('type', 'internal_invite')
      .eq('status', 'pending')
      .single(),
  ])

  if (existingUser?.is_internal) {
    return { success: false, error: 'User is already an internal employee' }
  }

  if (existingInvite) {
    return { success: false, error: 'An internal invite is already pending for this email' }
  }

  // Create invite
  const { data: invite, error: insertError } = await serviceClient
    .from('invites')
    .insert({
      email: email.toLowerCase(),
      type: 'internal_invite',
      organization_id: null,
      role: null,
      status: 'pending',
      created_by: user!.id,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[App Settings Error]', {
      type: 'create_internal_invite',
      timestamp: new Date().toISOString(),
      error: insertError.message,
    })
    return { success: false, error: 'Failed to create invite' }
  }

  // Send email
  const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invite/${invite.id}`

  try {
    const { sendEmail, FROM_EMAIL } = await import('@/lib/email/client')
    const InternalInviteEmail = (await import('@/emails/internal-invite-email')).default

    const result = await sendEmail({
      from: FROM_EMAIL,
      to: email,
      subject: "You've been invited to join the Selo team",
      react: InternalInviteEmail({
        inviteLink,
        invitedByEmail: user!.email ?? 'a team member',
      }),
    })

    if (result.error) {
      console.error('[App Settings Error]', {
        type: 'send_internal_invite_email',
        timestamp: new Date().toISOString(),
        error: result.error.message,
      })
    }
  } catch (err) {
    console.error('[App Settings Error]', {
      type: 'send_internal_invite_email',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    })
  }

  revalidatePath('/app-settings/team')
  return { success: true }
}

export async function removeInternalEmployee(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error, user, userRecord } = await requireInternalUser()
  if (error) return { success: false, error }
  if (userRecord!.role !== 'admin') return { success: false, error: 'Admin access required' }

  // Cannot remove yourself
  if (userId === user!.id) {
    return { success: false, error: 'You cannot remove yourself' }
  }

  const serviceClient = createServiceClient()

  // Delete from internal_employees
  const { error: deleteError } = await serviceClient
    .from('internal_employees')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    console.error('[App Settings Error]', {
      type: 'remove_employee',
      timestamp: new Date().toISOString(),
      error: deleteError.message,
    })
    return { success: false, error: 'Failed to remove employee' }
  }

  // Set is_internal = false
  await serviceClient.from('users').update({ is_internal: false }).eq('id', userId)

  // Delete auth user (cascades to users, team_members)
  const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(userId)

  if (authDeleteError) {
    console.error('[App Settings Error]', {
      type: 'delete_auth_user',
      timestamp: new Date().toISOString(),
      error: authDeleteError.message,
    })
    return { success: false, error: 'Failed to delete user account' }
  }

  revalidatePath('/app-settings/team')
  return { success: true }
}
