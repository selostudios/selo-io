import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { InviteStatus } from '@/lib/enums'
import { sanitizeRedirectPath } from '@/lib/security/redirect'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeRedirectPath(searchParams.get('next'))

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

      // Check if user is already internal (allows access even without org membership)
      const { data: userRecord } = await supabase
        .from('users')
        .select('is_internal')
        .eq('id', user.id)
        .single()

      if (userRecord?.is_internal) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      if (invite) {
        if (invite.type === 'internal_invite') {
          // Auto-accept internal invite
          const { createServiceClient } = await import('@/lib/supabase/server')
          const serviceClient = createServiceClient()

          await serviceClient
            .from('internal_employees')
            .upsert({ user_id: user.id, added_by: invite.created_by }, { onConflict: 'user_id' })

          await serviceClient.from('users').update({ is_internal: true }).eq('id', user.id)

          await supabase
            .from('invites')
            .update({
              status: InviteStatus.Accepted,
              accepted_at: new Date().toISOString(),
            })
            .eq('id', invite.id)
            .eq('status', InviteStatus.Pending)

          console.error('[Auth Callback]', {
            type: 'internal_invite_accepted',
            timestamp: new Date().toISOString(),
          })
          return NextResponse.redirect(`${origin}${next}`)
        }

        // Auto-accept: insert membership first (critical), then mark accepted
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

        console.error('[Auth Callback]', {
          type: 'invite_accepted',
          timestamp: new Date().toISOString(),
        })
        return NextResponse.redirect(`${origin}${next}`)
      }

      // No existing user and no pending invite - deny access
      console.error('[Auth Callback]', {
        type: 'access_denied_no_invite',
        timestamp: new Date().toISOString(),
      })
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/access-denied`)
    }
  }

  // Return error page
  return NextResponse.redirect(`${origin}/auth/error`)
}
