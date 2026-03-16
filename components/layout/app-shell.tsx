import Link from 'next/link'
import Image from 'next/image'
import { NavigationShell } from '@/components/navigation/navigation-shell'
import { UserMenu } from '@/components/dashboard/user-menu'
import { OrgSelector } from '@/components/shared/org-selector'
import { FeedbackProvider } from '@/components/feedback/feedback-provider'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'
import { FeedbackTrigger } from '@/components/feedback/feedback-trigger'
import type { OrganizationForSelector } from '@/lib/organizations/types'

interface AppShellProps {
  organizations: OrganizationForSelector[]
  isInternal: boolean
  userEmail: string
  firstName: string
  lastName: string
  role: string
  userRole?: string
  canViewFeedback: boolean
  children: React.ReactNode
}

export function AppShell({
  organizations,
  isInternal,
  userEmail,
  firstName,
  lastName,
  role,
  userRole,
  canViewFeedback,
  children,
}: AppShellProps) {
  return (
    <FeedbackProvider>
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
          <OrgSelector organizations={organizations} isInternal={isInternal} />
          <div className="flex-1" />
          <UserMenu userEmail={userEmail} firstName={firstName} lastName={lastName} role={role} />
        </header>
        {/* Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          <NavigationShell
            isInternal={isInternal}
            userRole={userRole}
            canViewFeedback={canViewFeedback}
          />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <FeedbackDialog />
      <FeedbackTrigger />
    </FeedbackProvider>
  )
}
