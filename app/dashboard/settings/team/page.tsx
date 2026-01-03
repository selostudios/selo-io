import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InviteUserDialog } from '@/components/settings/invite-user-dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteInvite } from './actions'

function formatJoinedDate(dateString: string): string {
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

  // Get team members
  const { data: teamMembers } = await supabase
    .from('users')
    .select(`
      id,
      role,
      created_at,
      email:id
    `)
    .eq('organization_id', userRecord.organization_id)
    .order('created_at', { ascending: false })

  // Get user emails from auth
  const teamMembersWithEmails = await Promise.all(
    (teamMembers || []).map(async (member) => {
      const { data: authUser } = await supabase.auth.admin.getUserById(member.id)
      return {
        ...member,
        email: authUser.user?.email || 'Unknown'
      }
    })
  )

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
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Team Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage team members for {org?.name || 'your organization'}
          </p>
        </div>
        {isAdmin && <InviteUserDialog />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Current members of your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembersWithEmails.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{member.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Joined {formatJoinedDate(member.created_at)}
                  </p>
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
                            Expired {expiresAt.toLocaleDateString()}
                          </span>
                        ) : (
                          <>Expires {expiresAt.toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {invite.role.replace('_', ' ')}
                      </Badge>
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
