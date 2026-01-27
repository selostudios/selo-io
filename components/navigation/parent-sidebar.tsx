'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { House, LineChart, Building2, LifeBuoy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type ParentSection = 'home' | 'seo' | 'organizations' | 'support'

interface ParentSidebarProps {
  activeSection: ParentSection
  onSectionChange: (section: ParentSection) => void
  isInternal?: boolean
}

type SectionItem = {
  id: ParentSection
  name: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  internalOnly?: boolean
}

const sections: SectionItem[] = [
  { id: 'home', name: 'Home', icon: House, href: '/dashboard' },
  { id: 'seo', name: 'SEO', icon: LineChart, href: '/seo/site-audit' },
  {
    id: 'organizations',
    name: 'Organizations',
    icon: Building2,
    href: '/organizations',
    internalOnly: true,
  },
  {
    id: 'support',
    name: 'Support',
    icon: LifeBuoy,
    href: '/support',
    internalOnly: true,
  },
]

export function ParentSidebar({
  activeSection,
  onSectionChange,
  isInternal = false,
}: ParentSidebarProps) {
  const searchParams = useSearchParams()
  const orgParam = searchParams.get('org')

  // Filter sections based on internal status
  const visibleSections = sections.filter((section) => !section.internalOnly || isInternal)

  // Preserve org parameter in logo link
  const logoHref = orgParam ? `/dashboard?org=${orgParam}` : '/dashboard'

  return (
    <div className="flex h-screen w-16 flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b">
        <Link href={logoHref}>
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
