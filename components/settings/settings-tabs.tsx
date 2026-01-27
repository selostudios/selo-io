'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const settingsTabs = [
  { name: 'Organization', href: '/settings/organization' },
  { name: 'Team', href: '/settings/team' },
  { name: 'Integrations', href: '/settings/integrations' },
  { name: 'Monitoring', href: '/settings/monitoring' },
]

export function SettingsTabs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const orgParam = searchParams.get('org')

  return (
    <div className="border-b">
      <nav className="flex gap-6">
        {settingsTabs.map((tab) => {
          const isActive = pathname === tab.href
          const href = orgParam ? `${tab.href}?org=${orgParam}` : tab.href

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
