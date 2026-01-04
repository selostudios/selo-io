import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InviteUserDialog } from '@/components/settings/invite-user-dialog'
import { ResendInviteButton } from '@/components/settings/resend-invite-button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { deleteInvite } from './actions'

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
  const day = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  const year = date.getFullYear()

  // Get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const ordinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  // Get time in 12-hour format
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12 || 12

  return `${dayOfWeek} ${ordinalSuffix(day)}, ${month} ${year} at ${hours}:${minutes}${ampm}`
}

export default async function TeamSettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's organization and role
  const { data: userRecord } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    redirect('/onboarding')
  }

  const isAdmin = userRecord.role === 'admin'

  // Get organization name
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', userRecord.organization_id)
    .single()

  // Get team members with emails using security definer function
  const { data: userEmails } = await supabase.rpc('get_organization_user_emails', {
    org_id: userRecord.organization_id
  })

  const { data: teamMembers } = await supabase
    .from('users')
    .select(`
      id,
      role,
      created_at
    `)
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  // Map emails and names to team members
  const userDataMap = new Map<string, { email: string; first_name: string; last_name: string }>(
    userEmails?.map((u: any) => [u.user_id, { email: u.email, first_name: u.first_name, last_name: u.last_name }]) || []
  )
  const teamMembersWithEmails = (teamMembers || []).map(member => {
    const userData = userDataMap.get(member.id)
    const fullName = userData
      ? `${userData.first_name}${userData.last_name ? ' ' + userData.last_name : ''}`.trim()
      : 'Unknown'
    return {
      ...member,
      name: fullName,
      email: userData?.email || 'Unknown'
    }
  })

  // Get pending invites (only if admin)
  let pendingInvites: any[] = []
  if (isAdmin) {
    const { data: invites } = await supabase
      .from('invites')
      .select('*')
      .eq('organization_id', userRecord.organization_id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    pendingInvites = invites || []
  }

  async function handleDeleteInvite(formData: FormData) {
    'use server'
    const inviteId = formData.get('inviteId') as string
    await deleteInvite(inviteId)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team members for {org?.name || 'your organization'}
          </p>
        </div>
        {isAdmin && <InviteUserDialog />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active</CardTitle>
          <CardDescription>
            Current team members with access to the organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembersWithEmails.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="size-10 mt-0.5">
                    <AvatarFallback className="text-sm font-medium">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Joined {formatDate(member.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                  {member.role.replace('_', ' ')}
                </Badge>
              </div>
            ))}
            {teamMembersWithEmails.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No team members found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>
              Invitations that haven't been accepted yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInvites.map((invite) => {
                const expiresAt = new Date(invite.expires_at)
                const isExpired = expiresAt < new Date()

                return (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {isExpired ? (
                          <span className="text-red-600">
                            Expired {formatDate(invite.expires_at)}
                          </span>
                        ) : (
                          <>Expires {formatDate(invite.expires_at)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {invite.role.replace('_', ' ')}
                      </Badge>
                      <ResendInviteButton inviteId={invite.id} email={invite.email} />
                      <form action={handleDeleteInvite}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Cancel
                        </Button>
                      </form>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
