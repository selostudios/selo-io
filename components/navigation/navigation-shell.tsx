'use client'

import { useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ParentSidebar, type ParentSection } from './parent-sidebar'
import { ChildSidebar } from './child-sidebar'
import { useActiveAudit } from '@/hooks/use-active-audit'
import { useOrgId } from '@/hooks/use-org-context'

export function getSectionFromPathname(pathname: string): ParentSection {
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

/** Sections with only a single nav item — no child sidebar needed */
const SINGLE_ITEM_SECTIONS: ParentSection[] = ['quick-audit', 'organizations', 'support']

/** Routes where the child sidebar should default to collapsed to maximize working area. */
const SLIDE_EDITOR_ROUTE = /\/reports\/performance\/[^/]+\/slides\//

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

  const isSlideEditor = SLIDE_EDITOR_ROUTE.test(pathname)
  const [isChildCollapsed, setIsChildCollapsed] = useState(isSlideEditor)
  const [previousIsSlideEditor, setPreviousIsSlideEditor] = useState(isSlideEditor)

  if (previousIsSlideEditor !== isSlideEditor) {
    setPreviousIsSlideEditor(isSlideEditor)
    setIsChildCollapsed(isSlideEditor)
  }

  // Derive active section from current pathname
  const activeSection = getSectionFromPathname(pathname)

  // Handle section change - navigate to section's default route
  const handleSectionChange = useCallback(
    (section: ParentSection) => {
      // Only navigate if we're changing to a different section
      if (section !== activeSection) {
        const baseRoute = sectionDefaultRoutes[section]
        const needsOrg = ['/dashboard', '/seo', '/settings'].some((p) => baseRoute.startsWith(p))
        const href = needsOrg && orgId ? `/${orgId}${baseRoute}` : baseRoute
        router.push(href)
      }
    },
    [activeSection, router, orgId]
  )

  const hideChildSidebar = SINGLE_ITEM_SECTIONS.includes(activeSection)

  return (
    <div className="sticky top-0 flex h-full border-r bg-white">
      <ParentSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        isInternal={isInternal}
        canViewFeedback={canViewFeedback}
      />
      {!hideChildSidebar && (
        <ChildSidebar
          activeSection={activeSection}
          hasActiveAudit={hasActiveAudit}
          userRole={userRole}
          isCollapsed={isChildCollapsed}
          onToggleCollapse={() => setIsChildCollapsed(!isChildCollapsed)}
        />
      )}
    </div>
  )
}
