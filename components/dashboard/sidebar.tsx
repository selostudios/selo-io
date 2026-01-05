'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Campaigns', href: '/dashboard/campaigns' },
  { name: 'Settings', href: '/settings/organization' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="min-h-screen w-64 border-r bg-white p-6">
      <div className="mb-8">
        <Link href="/dashboard">
          <Image
            src="/selo-logo.jpg.webp"
            alt="Selo Studios"
            width={94}
            height={38}
            priority
            className="cursor-pointer object-contain"
            style={{ marginLeft: -20, marginTop: -20 }}
          />
        </Link>
      </div>
      <nav className="space-y-1">
        {navigation.map((item) => {
          // Dashboard should only be active on exact match
          // Settings should be active on any /settings/* route
          // Campaigns can match child routes
          let isActive = false
          if (item.href === '/dashboard') {
            isActive = pathname === '/dashboard'
          } else if (item.href.startsWith('/settings')) {
            isActive = pathname.startsWith('/settings')
          } else {
            isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm font-medium',
                isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'
              )}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
