'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useBuildOrgHref } from '@/hooks/use-org-context'

interface WebsiteUrlToastProps {
  websiteUrl: string | null
}

export function WebsiteUrlToast({ websiteUrl }: WebsiteUrlToastProps) {
  const router = useRouter()
  const buildOrgHref = useBuildOrgHref()
  const hasShown = useRef(false)

  useEffect(() => {
    // Only show if no URL configured and haven't shown this session
    if (websiteUrl || hasShown.current) return

    const sessionKey = 'website-url-toast-shown'
    if (sessionStorage.getItem(sessionKey)) return

    hasShown.current = true
    sessionStorage.setItem(sessionKey, 'true')

    toast.warning('Website URL not configured', {
      description: 'Add customer website URL to enable SEO & AI auditing.',
      duration: 10000, // 10 seconds
      action: {
        label: 'Set Up',
        onClick: () => router.push(buildOrgHref('/settings/organization')),
      },
    })
  }, [websiteUrl, router, buildOrgHref])

  return null // This component only shows a toast, no visual output
}
