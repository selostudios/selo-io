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

      // Check membership and pending invite in parallel
      const [{ data: existingMembership, error: membershipError }, { data: invite }] =
        await Promise.all([
          supabase
            .from('team_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .limit(1)
            .single(),
          supabase
            .from('invites')
            .select('*')
            .eq('email', user.email.toLowerCase())
            .eq('status', InviteStatus.Pending)
            .gt('expires_at', new Date().toISOString())
            .single(),
        ])

      // Handle database errors on membership query (deny on error for safety)
      if (membershipError && membershipError.code !== 'PGRST116') {
        console.error('[Auth Callback] Failed to check team membership:', membershipError)
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/access-denied`)
      }

      // User already has a membership — allow access
      if (existingMembership) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      if (invite) {
        // Auto-accept: insert membership first (critical), then dual-write + mark accepted
        // Sequential to ensure membership exists before marking invite as accepted
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

        // Sync users table (required until RLS policies on other tables are migrated to team_members)
        await supabase.from('users').upsert(
          {
            id: user.id,
            organization_id: invite.organization_id,
            role: invite.role,
          },
          { onConflict: 'id' }
        )

        // Mark invite as accepted
        const { error: inviteUpdateError } = await supabase
          .from('invites')
          .update({
            status: InviteStatus.Accepted,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', invite.id)
          .eq('status', InviteStatus.Pending)

        if (inviteUpdateError) {
          console.error('[Auth Callback] Failed to update invite status:', inviteUpdateError)
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
