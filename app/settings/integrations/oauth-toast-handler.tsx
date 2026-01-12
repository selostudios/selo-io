'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getPlatformDisplayName } from '@/lib/oauth/utils'

export function OAuthToastHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const error = searchParams.get('error')
    const success = searchParams.get('success')
    const platform = searchParams.get('platform')

    try {
      // Handle errors
      if (error) {
        try {
          toast.error(decodeURIComponent(error), {
            duration: Infinity,
            closeButton: true,
            description: process.env.NODE_ENV === 'development' ? error : undefined,
          })
        } catch {
          // Fallback if URL decoding fails
          toast.error(error, {
            duration: Infinity,
            closeButton: true,
          })
        }
        router.replace('/settings/integrations')
        return
      }

      // Handle success
      if (success === 'connected' && platform) {
        const platformName = getPlatformDisplayName(platform)
        toast.success(`${platformName} connected successfully`, {
          duration: 5000,
        })
        router.replace('/settings/integrations')
        return
      }
    } catch (err) {
      console.error('[OAuth Toast Handler] Failed to process query params', {
        type: 'toast_handler_error',
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
    }
  }, [searchParams, router])

  return null
}
