import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { InviteUserForm } from '@/components/settings/invite-user-form'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteInvite } from './actions'

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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage team members for {org?.name || 'your organization'}
        </p>
      </div>

      {isAdmin && (
        <InviteUserForm />
      )}

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
                    Joined {new Date(member.created_at).toLocaleDateString()}
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
