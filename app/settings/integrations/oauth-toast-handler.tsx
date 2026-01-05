'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function OAuthToastHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    const platform = searchParams.get('platform')

    if (error) {
      toast.error(decodeURIComponent(error), {
        duration: Infinity,
        description: process.env.NODE_ENV === 'development' ? error : undefined,
      })
      // Clear error from URL
      router.replace('/settings/integrations')
    }

    if (success === 'connected' && platform) {
      const platformName =
        platform === 'linkedin'
          ? 'LinkedIn'
          : platform === 'google_analytics'
          ? 'Google Analytics'
          : platform
      toast.success(`${platformName} connected successfully`, {
        duration: 5000,
      })
      // Clear success from URL
      router.replace('/settings/integrations')
    }
  }, [searchParams, router])

  return null
}
