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

      // Check membership, user record, and pending invite in parallel
      const [{ data: existingMembership }, { data: existingUser }, { data: invite }] =
        await Promise.all([
          supabase
            .from('team_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .single(),
          supabase.from('users').select('organization_id').eq('id', user.id).single(),
          supabase
            .from('invites')
            .select('*')
            .eq('email', user.email.toLowerCase())
            .eq('status', InviteStatus.Pending)
            .gt('expires_at', new Date().toISOString())
            .single(),
        ])

      // User already has a membership — allow access
      if (existingMembership || existingUser?.organization_id) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      if (invite) {
        // Auto-accept: insert membership + dual-write to users + mark invite accepted
        const [{ error: memberError }, { error: userError }, { error: inviteError }] =
          await Promise.all([
            supabase.from('team_members').upsert(
              {
                user_id: user.id,
                organization_id: invite.organization_id,
                role: invite.role,
              },
              { onConflict: 'user_id,organization_id' }
            ),
            // Dual-write to users table (backward compat — removed in Phase 2)
            supabase.from('users').upsert(
              {
                id: user.id,
                organization_id: invite.organization_id,
                role: invite.role,
              },
              { onConflict: 'id' }
            ),
            supabase
              .from('invites')
              .update({
                status: InviteStatus.Accepted,
                accepted_at: new Date().toISOString(),
              })
              .eq('id', invite.id)
              .eq('status', InviteStatus.Pending),
          ])

        if (memberError) {
          console.error('[Auth Callback] Failed to create team membership:', memberError)
          await supabase.auth.signOut()
          return NextResponse.redirect(`${origin}/access-denied`)
        }

        if (userError) {
          console.error('[Auth Callback] Failed to update user record:', userError)
        }

        if (inviteError) {
          console.error('[Auth Callback] Failed to update invite status:', inviteError)
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
