'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ParentSidebar, type ParentSection } from './parent-sidebar'
import { ChildSidebar } from './child-sidebar'
import { useActiveAudit } from '@/hooks/use-active-audit'

const CHILD_SIDEBAR_COLLAPSED_KEY = 'child-sidebar-collapsed'

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
}

export function NavigationShell({ isInternal = false }: NavigationShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasSiteAudit, hasPerformanceAudit, hasAioAudit } = useActiveAudit()

  // Derive active section from current pathname
  const activeSection = getSectionFromPathname(pathname)

  const [isChildCollapsed, setIsChildCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Load collapsed state from localStorage on mount
  // This is a legitimate pattern for hydrating persisted UI state
  useEffect(() => {
    const saved = localStorage.getItem(CHILD_SIDEBAR_COLLAPSED_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrating persisted state on mount
    setIsChildCollapsed(saved === 'true')
    setMounted(true)

    // Listen for sidebar expand events (e.g., when selecting an organization)
    const handleExpand = () => {
      setIsChildCollapsed(false)
    }
    window.addEventListener('sidebar-expand', handleExpand)
    return () => window.removeEventListener('sidebar-expand', handleExpand)
  }, [])

  // Handle section change - navigate to section's default route
  const handleSectionChange = useCallback(
    (section: ParentSection) => {
      // Only navigate if we're changing to a different section
      if (section !== activeSection) {
        const baseRoute = sectionDefaultRoutes[section]
        const orgParam = searchParams.get('org')

        // Preserve org parameter for home and seo sections
        const href = orgParam && (section === 'home' || section === 'seo')
          ? `${baseRoute}?org=${orgParam}`
          : baseRoute

        router.push(href)
      }
    },
    [activeSection, router, searchParams]
  )

  // Toggle child sidebar collapsed state
  const handleToggleCollapse = useCallback(() => {
    setIsChildCollapsed((prev) => {
      const newValue = !prev
      localStorage.setItem(CHILD_SIDEBAR_COLLAPSED_KEY, String(newValue))
      return newValue
    })
  }, [])

  // Prevent hydration mismatch
  const collapsed = mounted ? isChildCollapsed : false

  return (
    <div className="sticky top-0 flex h-screen">
      <ParentSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        isInternal={isInternal}
      />
      <ChildSidebar
        activeSection={activeSection}
        isCollapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
        hasSiteAudit={hasSiteAudit}
        hasPerformanceAudit={hasPerformanceAudit}
        hasAioAudit={hasAioAudit}
      />
      {/* Expand button when child sidebar is collapsed */}
      {collapsed && (
        <div className="flex h-screen w-12 flex-col items-center border-r bg-white">
          <div className="flex h-16 w-full items-center justify-center border-b">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleToggleCollapse}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                    'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                  )}
                  aria-label="Expand sidebar"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expand</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}
