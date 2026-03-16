'use client'

import { useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ParentSidebar, type ParentSection } from './parent-sidebar'
import { ChildSidebar } from './child-sidebar'
import { useActiveAudit } from '@/hooks/use-active-audit'
import { useOrgId } from '@/hooks/use-org-context'

function getSectionFromPathname(pathname: string): ParentSection {
  // Strip leading UUID segment if present
  const stripped = pathname.replace(
    /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    ''
  )
  if (stripped.startsWith('/quick-audit')) return 'quick-audit'
  if (stripped.startsWith('/organizations')) return 'organizations'
  if (stripped.startsWith('/app-settings')) return 'app-settings'
  if (stripped.startsWith('/support')) return 'support'
  // Default to home for /dashboard, /settings, /profile, etc.
  return 'home'
}

const sectionDefaultRoutes: Record<ParentSection, string> = {
  home: '/dashboard',
  'quick-audit': '/quick-audit',
  organizations: '/organizations',
  'app-settings': '/app-settings/team',
  support: '/support',
}

interface NavigationShellProps {
  isInternal?: boolean
  userRole?: string
  canViewFeedback?: boolean
}

export function NavigationShell({
  isInternal = false,
  userRole,
  canViewFeedback = false,
}: NavigationShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const orgId = useOrgId()
  const { hasActiveAudit } = useActiveAudit(orgId)

  const [isChildCollapsed, setIsChildCollapsed] = useState(false)

  // Derive active section from current pathname
  const activeSection = getSectionFromPathname(pathname)

  // Handle section change - navigate to section's default route
  const handleSectionChange = useCallback(
    (section: ParentSection) => {
      // Only navigate if we're changing to a different section
      if (section !== activeSection) {
        const baseRoute = sectionDefaultRoutes[section]
        const needsOrg = ['/dashboard', '/seo', '/settings', '/support'].some((p) =>
          baseRoute.startsWith(p)
        )
        const href = needsOrg && orgId ? `/${orgId}${baseRoute}` : baseRoute
        router.push(href)
      }
    },
    [activeSection, router, orgId]
  )

  return (
    <div className="sticky top-0 flex h-full border-r bg-white">
      <ParentSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        isInternal={isInternal}
        canViewFeedback={canViewFeedback}
      />
      <ChildSidebar
        activeSection={activeSection}
        hasActiveAudit={hasActiveAudit}
        userRole={userRole}
        isCollapsed={isChildCollapsed}
        onToggleCollapse={() => setIsChildCollapsed(!isChildCollapsed)}
      />
    </div>
  )
}
