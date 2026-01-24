'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Megaphone, Settings, FileSearch, Gauge, PanelLeftClose } from 'lucide-react'
import { cn } from '@/lib/utils'
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
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
      { name: 'Settings', href: '/settings/organization', icon: Settings },
    ],
  },
]

const seoNavigation: NavigationGroup[] = [
  {
    header: 'On Page & Tech SEO',
    items: [
      { name: 'Site Audit', href: '/seo/site-audit', icon: FileSearch },
      { name: 'Page Speed', href: '/seo/page-speed', icon: Gauge },
    ],
  },
]

const navigationConfig: Record<ParentSection, NavigationGroup[]> = {
  home: homeNavigation,
  seo: seoNavigation,
}

const sectionTitles: Record<ParentSection, string> = {
  home: 'Home',
  seo: 'SEO',
}

interface ChildSidebarProps {
  activeSection: ParentSection
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function ChildSidebar({ activeSection, isCollapsed, onToggleCollapse }: ChildSidebarProps) {
  const pathname = usePathname()
  const navigation = navigationConfig[activeSection]

  if (isCollapsed) {
    return null
  }

  return (
    <div className="flex h-screen w-60 flex-col border-r bg-white">
      {/* Header with logo and section title */}
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <Link href="/dashboard">
          <Image
            src="/selo-logo.jpg.webp"
            alt="Selo Studios"
            width={94}
            height={38}
            priority
            className="cursor-pointer object-contain"
            style={{ marginLeft: -10 }}
          />
        </Link>
      </div>

      {/* Section title */}
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">{sectionTitles[activeSection]}</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-4 px-3">
        {navigation.map((group, groupIndex) => (
          <div key={groupIndex}>
            {group.header && (
              <h3 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
                {group.header}
              </h3>
            )}
            <div className="space-y-1">
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

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse button */}
      <div className="border-t p-4">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-5 w-5" />
          <span>Collapse</span>
        </button>
      </div>
    </div>
  )
}
