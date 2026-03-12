'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { acceptInvite } from './actions'

export function AcceptButton({ inviteId }: { inviteId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const handleAccept = async () => {
    setError(null)
    setIsPending(true)
    try {
      const result = await acceptInvite(inviteId)
      if (result?.error) {
        setError(result.error)
      }
      // If no error returned, the action called redirect() which throws (expected)
    } catch {
      // redirect() throws a NEXT_REDIRECT error — this is expected behavior
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleAccept} disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Accepting...
          </>
        ) : (
          'Accept Invitation'
        )}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
