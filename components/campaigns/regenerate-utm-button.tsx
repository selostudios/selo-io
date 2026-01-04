'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { regenerateUtmParameters } from '@/app/dashboard/campaigns/actions'
import { showSuccess, showError } from '@/components/ui/sonner'
import { useRouter } from 'next/navigation'

interface RegenerateUtmButtonProps {
  campaignId: string
}

export function RegenerateUtmButton({ campaignId }: RegenerateUtmButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  async function handleRegenerate() {
    setIsLoading(true)

    const result = await regenerateUtmParameters(campaignId)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess('UTM parameters regenerated')
      router.refresh()
    }

    setIsLoading(false)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRegenerate}
      disabled={isLoading}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Regenerating...' : 'Regenerate'}
    </Button>
  )
}
