'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  Megaphone,
  Settings,
  Loader2,
  Building2,
  MessageSquare,
  FileText,
  ClipboardCheck,
  PanelLeftClose,
  Zap,
  Users,
  Plug,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { canViewDashboard, canViewCampaigns } from '@/lib/permissions'
import type { ParentSection } from './parent-sidebar'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavigationGroup {
  header?: string
  items: NavigationItem[]
}

const homeNavigation: NavigationGroup[] = [
  {
    header: 'Marketing',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
    ],
  },
  {
    header: 'SEO / AIO',
    items: [
      { name: 'Full Site Audit', href: '/seo/audit', icon: ClipboardCheck },
      { name: 'Client Reports', href: '/seo/client-reports', icon: FileText },
    ],
  },
  {
    items: [{ name: 'Settings', href: '/settings/organization', icon: Settings }],
  },
]

const quickAuditNavigation: NavigationGroup[] = [
  {
    items: [{ name: 'Run Audit', href: '/quick-audit', icon: Zap }],
  },
]

const organizationsNavigation: NavigationGroup[] = [
  {
    items: [{ name: 'All Organizations', href: '/organizations', icon: Building2 }],
  },
]

const appSettingsNavigation: NavigationGroup[] = [
  {
    items: [
      { name: 'Team', href: '/app-settings/team', icon: Users },
      { name: 'Integrations', href: '/app-settings/integrations', icon: Plug },
      { name: 'System', href: '/app-settings/system', icon: Activity },
    ],
  },
]

const supportNavigation: NavigationGroup[] = [
  {
    items: [{ name: 'Feedback', href: '/support', icon: MessageSquare }],
  },
]

const navigationConfig: Record<ParentSection, NavigationGroup[]> = {
  home: homeNavigation,
  'quick-audit': quickAuditNavigation,
  organizations: organizationsNavigation,
  'app-settings': appSettingsNavigation,
  support: supportNavigation,
}

interface ChildSidebarProps {
  activeSection: ParentSection
  hasActiveAudit?: boolean
  userRole?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function ChildSidebar({
  activeSection,
  hasActiveAudit,
  userRole,
  isCollapsed = false,
  onToggleCollapse,
}: ChildSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Filter home navigation items based on user role
  const navigation = navigationConfig[activeSection].map((group) => ({
    ...group,
    items:
      activeSection === 'home'
        ? group.items.filter((item) => {
            if (item.href === '/dashboard') return canViewDashboard(userRole)
            if (item.href === '/dashboard/campaigns') return canViewCampaigns(userRole)
            return true
          })
        : group.items,
  }))

  // Get current org parameter to preserve across navigation
  const orgParam = searchParams.get('org')

  return (
    <div className={cn('flex flex-col bg-white', isCollapsed ? 'w-12' : 'w-[304px]')}>
      {/* Navigation */}
      <nav className={cn('flex-1 pt-3', isCollapsed ? 'space-y-2 px-1' : 'space-y-4 px-3')}>
        {navigation.map((group, groupIndex) => (
          <div key={groupIndex}>
            {!isCollapsed && group.header && (
              <h3 className="mb-2 px-3 text-xs font-medium tracking-wider text-neutral-500 uppercase">
                {group.header}
              </h3>
            )}
            <div className={cn(isCollapsed ? 'flex flex-col items-center gap-2' : 'space-y-1')}>
              {group.items.map((item) => {
                const Icon = item.icon

                // Determine if this item is active
                let isActive = false
                if (item.href === '/dashboard') {
                  isActive = pathname === '/dashboard'
                } else if (item.href.startsWith('/settings')) {
                  isActive = pathname.startsWith('/settings')
                } else {
                  isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                }

                // Show spinner for active unified audit
                const showSpinner = item.href === '/seo/audit' && hasActiveAudit

                // Preserve org parameter for SEO, Settings, and Dashboard links
                let href = item.href
                if (
                  orgParam &&
                  (item.href.startsWith('/seo') ||
                    item.href.startsWith('/settings') ||
                    item.href.startsWith('/dashboard'))
                ) {
                  href = `${item.href}?org=${orgParam}`
                }

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link
                          href={href}
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                            isActive
                              ? 'text-neutral-900'
                              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                          )}
                        >
                          {showSpinner ? (
                            <Loader2 className="h-5 w-5 motion-safe:animate-spin" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.name}</TooltipContent>
                    </Tooltip>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'font-semibold text-neutral-900'
                        : 'font-medium text-neutral-600 hover:bg-neutral-100'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="flex-1">{item.name}</span>
                    {showSpinner && (
                      <Loader2 className="h-4 w-4 text-neutral-400 motion-safe:animate-spin" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      {/* Collapse/Expand button at bottom-right */}
      {onToggleCollapse && (
        <div
          className={cn(
            'flex items-center border-t px-3 py-2',
            isCollapsed ? 'justify-center' : 'justify-end'
          )}
        >
          <button
            onClick={onToggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeftClose className={cn('h-4 w-4', isCollapsed && 'rotate-180')} />
          </button>
        </div>
      )}
    </div>
  )
}
