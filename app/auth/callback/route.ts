import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { InviteStatus } from '@/lib/enums'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the authenticated user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.email) {
        console.error('[Auth Callback] No user email after session exchange')
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/access-denied`)
      }

      // Check if user already has a membership
      const { data: existingMembership } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (existingMembership) {
        // User already belongs to an organization, allow access
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Fallback: check users table (backward compat)
      const { data: existingUser } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (existingUser?.organization_id) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      // Check for a pending invite for this email
      const { data: invite } = await supabase
        .from('invites')
        .select('*')
        .eq('email', user.email.toLowerCase())
        .eq('status', InviteStatus.Pending)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (invite) {
        // Auto-accept the invite — insert membership + dual-write to users
        const { error: memberError } = await supabase.from('team_members').upsert(
          {
            user_id: user.id,
            organization_id: invite.organization_id,
            role: invite.role,
          },
          { onConflict: 'user_id,organization_id' }
        )

        if (memberError) {
          console.error('[Auth Callback] Failed to create team membership:', memberError)
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/access-denied`)
        }

        // Dual-write to users table (backward compat — removed in Phase 2)
        const { error: userError } = await supabase.from('users').upsert(
          {
            id: user.id,
            organization_id: invite.organization_id,
            role: invite.role,
          },
          { onConflict: 'id' }
        )

        if (userError) {
          console.error('[Auth Callback] Failed to update user record:', userError)
          // Non-fatal: membership already created, continue
        }

        // Mark invite as accepted
        const { error: inviteError } = await supabase
          .from('invites')
          .update({
            status: InviteStatus.Accepted,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', invite.id)
          .eq('status', InviteStatus.Pending)

        if (inviteError) {
          console.error('[Auth Callback] Failed to update invite status:', inviteError)
          // User is already created, so we can continue
        }

        console.log('[Auth Callback] Auto-accepted invite for:', user.email)
        return NextResponse.redirect(`${origin}${next}`)
      }

      // No existing user and no pending invite - deny access
      console.log('[Auth Callback] Access denied - no invite found for:', user.email)
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/access-denied`)
    }
  }

  // Return error page
  return NextResponse.redirect(`${origin}/auth/error`)
}
