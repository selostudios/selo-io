'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Megaphone, Search, Settings, PanelLeftClose, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiresWebsiteUrl?: boolean
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
  { name: 'Site SEO & Performance', href: '/audit', icon: Search, requiresWebsiteUrl: true },
  { name: 'Settings', href: '/settings/organization', icon: Settings },
]

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

interface SidebarProps {
  websiteUrl?: string | null
}

interface SidebarState {
  isCollapsed: boolean
  mounted: boolean
}

export function Sidebar({ websiteUrl }: SidebarProps) {
  const pathname = usePathname()
  const [state, setState] = useState<SidebarState>({ isCollapsed: false, mounted: false })

  // Load saved state from localStorage on mount
  // This is a legitimate pattern for hydrating persisted UI state
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrating persisted state on mount
    setState({ isCollapsed: saved === 'true', mounted: true })
  }, [])

  // Save state to localStorage
  const toggleCollapsed = useCallback(() => {
    setState((prev) => {
      const newCollapsed = !prev.isCollapsed
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newCollapsed))
      return { ...prev, isCollapsed: newCollapsed }
    })
  }, [])

  // Prevent hydration mismatch by rendering expanded state initially
  const collapsed = state.mounted ? state.isCollapsed : false

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col border-r bg-white transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn('p-4', collapsed ? 'px-2' : 'p-6')}>
        <div className={cn('mb-8', collapsed && 'flex justify-center')}>
          <Link href="/dashboard">
            {collapsed ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-900 text-white font-bold text-lg">
                S
              </div>
            ) : (
              <Image
                src="/selo-logo.jpg.webp"
                alt="Selo Studios"
                width={94}
                height={38}
                priority
                className="cursor-pointer object-contain"
                style={{ marginLeft: -10, marginTop: -20 }}
              />
            )}
          </Link>
        </div>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon

            // Dashboard should only be active on exact match
            // Settings should be active on any /settings/* route
            // Audit should be active on any /audit/* route
            // Campaigns can match child routes
            let isActive = false
            if (item.href === '/dashboard') {
              isActive = pathname === '/dashboard'
            } else if (item.href.startsWith('/settings')) {
              isActive = pathname.startsWith('/settings')
            } else if (item.href === '/audit') {
              isActive = pathname === '/audit' || pathname.startsWith('/audit/')
            } else {
              isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            }

            // Check if item is disabled (requires website URL but none provided)
            const isDisabled = item.requiresWebsiteUrl && !websiteUrl

            const linkContent = (
              <span
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isDisabled
                    ? 'cursor-not-allowed text-neutral-400'
                    : isActive
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                )}
              >
                <Icon className="size-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </span>
            )

            if (isDisabled) {
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <span className="block">{linkContent}</span>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.name}</TooltipContent>
                </Tooltip>
              ) : (
                <span key={item.href} className="block">
                  {linkContent}
                </span>
              )
            }

            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link href={item.href} className="block">
                    {linkContent}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ) : (
              <Link key={item.href} href={item.href} className="block">
                {linkContent}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Toggle button at bottom */}
      <div className={cn('mt-auto border-t p-4', collapsed && 'px-2')}>
        <button
          onClick={toggleCollapsed}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors',
            collapsed && 'justify-center px-2'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="size-5" />
          ) : (
            <>
              <PanelLeftClose className="size-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
