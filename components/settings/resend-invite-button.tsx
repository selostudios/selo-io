'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { resendInvite } from '@/app/settings/team/actions'
import { showSuccess, showError } from '@/components/ui/sonner'

interface ResendInviteButtonProps {
  inviteId: string
  email: string
}

export function ResendInviteButton({ inviteId, email }: ResendInviteButtonProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleResend() {
    setIsLoading(true)
    const result = await resendInvite(inviteId)
    setIsLoading(false)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess(result.message || `Invite resent to ${email}!`)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Resend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resend Invite</DialogTitle>
          <DialogDescription>
            Are you sure you want to resend the invitation to {email}? This will also extend the expiration by 7 days.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleResend} disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Resend Invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
