'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const settingsTabs = [
  { name: 'Organization', href: '/settings/organization' },
  { name: 'Team', href: '/settings/team' },
  { name: 'Integrations', href: '/settings/integrations' },
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
    <div className="border-b">
      <nav className="flex gap-6">
        {settingsTabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
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
