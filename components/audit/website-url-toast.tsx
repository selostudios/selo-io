'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface WebsiteUrlToastProps {
  websiteUrl: string | null
}

export function WebsiteUrlToast({ websiteUrl }: WebsiteUrlToastProps) {
  const router = useRouter()
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
        onClick: () => router.push('/settings/organization'),
      },
    })
  }, [websiteUrl, router])

  return null // This component only shows a toast, no visual output
}
