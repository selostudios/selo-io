import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { acceptInvite } from './actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AcceptInvitePageProps {
  params: Promise<{ id: string }>
}

export default async function AcceptInvitePage({ params }: AcceptInvitePageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=/accept-invite/${id}`)
  }

  // Get the invite
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select(
      `
      *,
      organization:organizations(name)
    `
    )
    .eq('id', id)
    .single()

  if (inviteError || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite Not Found</CardTitle>
            <CardDescription>This invitation link is invalid or has been removed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Check if already accepted
  if (invite.accepted_at) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite Already Used</CardTitle>
            <CardDescription>This invitation has already been accepted.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/dashboard">Go to Dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if expired
  const expiresAt = new Date(invite.expires_at)
  const isExpired = expiresAt < new Date()

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invite Expired</CardTitle>
            <CardDescription>
              This invitation expired on {expiresAt.toLocaleDateString()}. Please request a new
              invitation.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Check if email matches
  if (user.email !== invite.email) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email Mismatch</CardTitle>
            <CardDescription>
              This invitation was sent to {invite.email}, but you are logged in as {user.email}.
              Please log in with the correct email address.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  async function handleAccept() {
    'use server'
    await acceptInvite(id)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&apos;ve Been Invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join {invite.organization?.name || 'an organization'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              <strong>Email:</strong> {invite.email}
            </p>
            <p className="text-muted-foreground text-sm">
              <strong>Role:</strong>{' '}
              <Badge variant="outline">{invite.role.replace('_', ' ')}</Badge>
            </p>
            <p className="text-muted-foreground text-sm">
              <strong>Expires:</strong> {expiresAt.toLocaleDateString()}
            </p>
          </div>

          <form action={handleAccept}>
            <Button type="submit" className="w-full">
              Accept Invitation
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
