'use client'

import { useState, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ParentSidebar, type ParentSection } from './parent-sidebar'
import { ChildSidebar } from './child-sidebar'
import { useActiveAudit } from '@/hooks/use-active-audit'

function getSectionFromPathname(pathname: string): ParentSection {
  if (pathname.startsWith('/seo')) {
    return 'seo'
  }
  if (pathname.startsWith('/organizations')) {
    return 'organizations'
  }
  if (pathname.startsWith('/support')) {
    return 'support'
  }
  // Default to home for /dashboard, /settings, /profile, etc.
  return 'home'
}

const sectionDefaultRoutes: Record<ParentSection, string> = {
  home: '/dashboard',
  seo: '/seo/site-audit',
  organizations: '/organizations',
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
  const searchParams = useSearchParams()
  const orgParam = searchParams.get('org')
  const { hasSiteAudit, hasPerformanceAudit, hasAioAudit } = useActiveAudit(orgParam)

  const [isChildCollapsed, setIsChildCollapsed] = useState(false)

  // Derive active section from current pathname
  const activeSection = getSectionFromPathname(pathname)

  // Handle section change - navigate to section's default route
  const handleSectionChange = useCallback(
    (section: ParentSection) => {
      // Only navigate if we're changing to a different section
      if (section !== activeSection) {
        const baseRoute = sectionDefaultRoutes[section]

        // Preserve org parameter for home and seo sections
        const href =
          orgParam && (section === 'home' || section === 'seo')
            ? `${baseRoute}?org=${orgParam}`
            : baseRoute

        router.push(href)
      }
    },
    [activeSection, router, orgParam]
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
        hasSiteAudit={hasSiteAudit}
        hasPerformanceAudit={hasPerformanceAudit}
        hasAioAudit={hasAioAudit}
        userRole={userRole}
        isCollapsed={isChildCollapsed}
        onToggleCollapse={() => setIsChildCollapsed(!isChildCollapsed)}
      />
    </div>
  )
}
