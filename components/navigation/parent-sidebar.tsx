'use client'

import Link from 'next/link'
import Image from 'next/image'
import { House, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type ParentSection = 'home' | 'seo'

interface ParentSidebarProps {
  activeSection: ParentSection
  onSectionChange: (section: ParentSection) => void
}

const sections: Array<{
  id: ParentSection
  name: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}> = [
  { id: 'home', name: 'Home', icon: House, href: '/dashboard' },
  { id: 'seo', name: 'SEO', icon: LineChart, href: '/seo/site-audit' },
]

export function ParentSidebar({ activeSection, onSectionChange }: ParentSidebarProps) {
  return (
    <div className="flex h-screen w-16 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b">
        <Link href="/dashboard">
          <Image
            src="/selo-logo.jpg.webp"
            alt="Selo"
            width={40}
            height={40}
            priority
            className="object-contain"
          />
        </Link>
      </div>

      {/* Navigation Icons */}
      <nav className="flex flex-1 flex-col items-center gap-2 py-4">
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = activeSection === section.id

          return (
            <Tooltip key={section.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSectionChange(section.id)}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                    isActive
                      ? 'bg-violet-100 text-violet-700'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  )}
                  aria-label={section.name}
                >
                  <Icon className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{section.name}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </div>
  )
}
