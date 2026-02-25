import { createClient } from '@/lib/supabase/server'
import { InviteUserDialog } from '@/components/settings/invite-user-dialog'
import { ResendInviteButton } from '@/components/settings/resend-invite-button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { deleteInvite } from './actions'
import { formatDate, displayName } from '@/lib/utils'
import { canManageTeam } from '@/lib/permissions'
import { withSettingsAuth, NoOrgSelected } from '@/lib/auth/settings-auth'

export const dynamic = 'force-dynamic'

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

interface PageProps {
  searchParams: Promise<{ org?: string }>
}

export default async function TeamSettingsPage({ searchParams }: PageProps) {
  const result = await withSettingsAuth(
    searchParams,
    async (organizationId, { isInternal, userRecord }) => {
      const supabase = await createClient()
      const isAdmin = isInternal || canManageTeam(userRecord.role)

      // Get organization name
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()

      // Get team members with emails using security definer function
      const { data: userEmails } = await supabase.rpc('get_organization_user_emails', {
        org_id: organizationId,
      })

      const { data: teamMembers } = await supabase
        .from('users')
        .select('id, role, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      // Map emails and names to team members
      const userDataMap = new Map<string, { email: string; first_name: string; last_name: string }>(
        userEmails?.map(
          (u: { user_id: string; email: string; first_name: string; last_name: string }) => [
            u.user_id,
            { email: u.email, first_name: u.first_name, last_name: u.last_name },
          ]
        ) || []
      )
      const teamMembersWithEmails = (teamMembers || []).map((member) => {
        const userData = userDataMap.get(member.id)
        const fullName = userData
          ? `${userData.first_name}${userData.last_name ? ' ' + userData.last_name : ''}`.trim()
          : 'Unknown'
        return {
          ...member,
          name: fullName,
          email: userData?.email || 'Unknown',
        }
      })

      // Get pending invites (only if admin)
      let pendingInvites: Array<{
        id: string
        email: string
        role: string
        expires_at: string
      }> = []
      if (isAdmin) {
        const { data: invites } = await supabase
          .from('invites')
          .select('*')
          .eq('organization_id', organizationId)
          .is('accepted_at', null)
          .order('created_at', { ascending: false })

        pendingInvites = invites || []
      }

      return { org, teamMembersWithEmails, pendingInvites, isAdmin }
    },
    'Select an organization to view team members.'
  )

  if (result.type === 'no-org') {
    return <NoOrgSelected message={result.message} />
  }

  const { org, teamMembersWithEmails, pendingInvites, isAdmin } = result.data

  async function handleDeleteInvite(formData: FormData) {
    'use server'
    const inviteId = formData.get('inviteId') as string
    await deleteInvite(inviteId)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Team Members</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage team members for {org?.name || 'your organization'}
          </p>
        </div>
        {isAdmin && <InviteUserDialog />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active</CardTitle>
          <CardDescription>Current team members with access to the organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembersWithEmails.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="mt-0.5 size-10">
                    <AvatarFallback className="text-sm font-medium">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-muted-foreground text-sm">{member.email}</p>
                    <p className="text-muted-foreground text-sm">
                      Joined {formatDate(member.created_at)}
                    </p>
                  </div>
                </div>
                <Badge>{displayName(member.role)}</Badge>
              </div>
            ))}
            {teamMembersWithEmails.length === 0 && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No team members found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>Invitations that haven&apos;t been accepted yet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInvites.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">No pending invites</p>
              ) : (
                pendingInvites.map((invite) => {
                  const expiresAt = new Date(invite.expires_at)
                  const isExpired = expiresAt < new Date()

                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-muted-foreground text-sm">
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
                        <Badge variant="outline">{displayName(invite.role)}</Badge>
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
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
