'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function AuditNavTabs() {
  const pathname = usePathname()

  const tabs = [
    { href: '/audit', label: 'Site Audit' },
    { href: '/audit/performance', label: 'Performance' },
  ]

  return (
    <nav className="flex gap-4 border-b px-8">
      {tabs.map((tab) => {
        // Active if exact match or if pathname starts with tab href (for nested routes)
        // But /audit should only match exactly, not /audit/performance
        const isActive =
          tab.href === '/audit'
            ? pathname === '/audit' ||
              (pathname?.startsWith('/audit/') && !pathname?.startsWith('/audit/performance'))
            : pathname?.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-1 pb-3 pt-4 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
