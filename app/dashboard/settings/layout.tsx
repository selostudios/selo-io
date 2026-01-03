'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const settingsTabs = [
  { name: 'Organization', href: '/dashboard/settings/organization' },
  { name: 'Team', href: '/dashboard/settings/team' },
  { name: 'Integrations', href: '/dashboard/settings/integrations' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and organization preferences
        </p>
      </div>

      <div className="border-b">
        <nav className="flex gap-6">
          {settingsTabs.map((tab) => {
            const isActive = pathname === tab.href
            // Extract just the last part of the href for the Link
            const relativeHref = tab.href.split('/').pop() || ''
            return (
              <Link
                key={tab.href}
                href={relativeHref}
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

      {children}
    </div>
  )
}
