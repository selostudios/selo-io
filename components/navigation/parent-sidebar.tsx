'use client'

import { House, Zap, Building2, Settings2, LifeBuoy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type ParentSection = 'home' | 'quick-audit' | 'organizations' | 'app-settings' | 'support'

interface ParentSidebarProps {
  activeSection: ParentSection
  onSectionChange: (section: ParentSection) => void
  isInternal?: boolean
  canViewFeedback?: boolean
}

type SectionItem = {
  id: ParentSection
  name: string
  icon: React.ComponentType<{ className?: string }>
  internalOnly?: boolean
}

const sections: SectionItem[] = [
  { id: 'home', name: 'Home', icon: House },
  { id: 'quick-audit', name: 'Quick Audit', icon: Zap, internalOnly: true },
  { id: 'organizations', name: 'Organizations', icon: Building2, internalOnly: true },
  { id: 'app-settings' as const, name: 'App Settings', icon: Settings2, internalOnly: true },
  { id: 'support', name: 'Support', icon: LifeBuoy, internalOnly: true },
]

export function ParentSidebar({
  activeSection,
  onSectionChange,
  isInternal = false,
  canViewFeedback = false,
}: ParentSidebarProps) {
  // Filter sections based on internal status and permissions
  const visibleSections = sections.filter((section) => {
    if (section.id === 'support') return isInternal || canViewFeedback
    return !section.internalOnly || isInternal
  })

  return (
    <div className="flex w-16 flex-col border-r bg-white">
      {/* Navigation Icons */}
      <nav className="flex flex-1 flex-col items-center gap-2 pt-3">
        {visibleSections.map((section) => {
          const Icon = section.icon
          const isActive = activeSection === section.id

          return (
            <Tooltip key={section.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSectionChange(section.id)}
                  className={cn(
                    'flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors',
                    isActive ? 'bg-amber-100 text-amber-700' : 'text-neutral-600 hover:bg-amber-50'
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
