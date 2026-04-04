'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { canManageIntegrations } from '@/lib/permissions'
import { UserRole } from '@/lib/enums'
import { useOrgId } from '@/hooks/use-org-context'

type SettingsTab = {
  name: string
  href: string
}

const allSettingsTabs: SettingsTab[] = [
  { name: 'Organization', href: '/settings/organization' },
  { name: 'Team', href: '/settings/team' },
  { name: 'Integrations', href: '/settings/integrations' },
  { name: 'Monitoring', href: '/settings/monitoring' },
]

function getVisibleTabs(userRole?: string, isInternal?: boolean): SettingsTab[] {
  return allSettingsTabs.filter((tab) => {
    if (tab.href === '/settings/integrations') return isInternal || canManageIntegrations(userRole)
    if (tab.href === '/settings/monitoring') return userRole !== UserRole.ExternalDeveloper
    return true
  })
}

interface SettingsTabsProps {
  userRole?: string
  isInternal?: boolean
}

export function SettingsTabs({ userRole, isInternal }: SettingsTabsProps) {
  const pathname = usePathname()
  const orgId = useOrgId()

  const strippedPathname = pathname.replace(
    /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    ''
  )

  const visibleTabs = getVisibleTabs(userRole, isInternal)

  return (
    <div className="border-b">
      <nav className="flex gap-6">
        {visibleTabs.map((tab) => {
          const isActive = strippedPathname === tab.href
          const href = orgId ? `/${orgId}${tab.href}` : tab.href

          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              )}
            >
              {tab.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
