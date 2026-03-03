import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgSelector } from '@/components/shared/org-selector'
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'
import { OrgProvider } from '@/hooks/use-org-context'
import { canViewFeedback, isInternalUser, UserRole } from '@/lib/permissions'
import { getAuthUser, getUserRecord, getOrganizationsList } from '@/lib/auth/cached'
import { resolveOrganizationId } from '@/lib/auth/resolve-org'
import type { OrganizationForSelector } from '@/lib/organizations/types'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const userRecord = await getUserRecord(user.id)

  if (!userRecord || !canViewFeedback(userRecord.role)) {
    redirect('/dashboard')
  }

  const isInternal = isInternalUser(userRecord)

  // Resolve org data for the OrgSelector
  const resolvedOrgId = await resolveOrganizationId(
    undefined,
    userRecord.organization_id,
    isInternal
  )

  let organizations: OrganizationForSelector[] = []
  if (isInternal) {
    organizations = await getOrganizationsList()
  } else {
    const userOrg = userRecord.organization
    if (userOrg) {
      organizations = [
        {
          id: userOrg.id,
          name: userOrg.name,
          website_url: userOrg.website_url,
          status: userOrg.status as OrganizationForSelector['status'],
          logo_url: userOrg.logo_url,
        },
      ]
    }
  }

  const userEmail = user.email || ''
  const firstName = userRecord.first_name || userEmail.split('@')[0]
  const lastName = userRecord.last_name || ''
  const role = userRecord.role || UserRole.TeamMember

  return (
    <FeedbackProvider>
      <OrgProvider>
        <div className="flex h-screen flex-col bg-neutral-50">
          {/* Full-width top bar */}
          <header className="flex h-16 flex-shrink-0 items-center gap-3 border-b bg-white px-4">
            <Link href="/dashboard" className="flex-shrink-0">
              <Image
                src="/selo-logo.jpg.webp"
                alt="Selo"
                width={32}
                height={32}
                priority
                className="object-contain"
              />
            </Link>
            <OrgSelector
              organizations={organizations}
              isInternal={isInternal}
              selectedOrganizationId={resolvedOrgId}
            />
            <div className="flex-1" />
            <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
          </header>
          {/* Sidebar + Content */}
          <div className="flex flex-1 overflow-hidden">
            <NavigationShell
              isInternal={isInternal}
              userRole={userRecord.role}
              canViewFeedback={canViewFeedback(userRecord.role)}
            />
            <main className="flex-1 overflow-y-auto">
              <div className="space-y-6 p-8">{children}</div>
            </main>
          </div>
        </div>
        <FeedbackDialog />
        <FeedbackTrigger />
      </OrgProvider>
    </FeedbackProvider>
  )
}
