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
    <div className="border-b">
      <nav aria-label="Audit sections" className="flex gap-6">
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
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'border-b-2 pb-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
